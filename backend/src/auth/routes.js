import { Router } from 'express'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { pool } from '../db.js'
import { hashPassword, verifyPassword } from './passwords.js'
import { clearSession, createSession, formatSessionUser, getSessionUser, requireAuth } from './sessions.js'
import { validateLogin, validateRegistration } from './validation.js'
import { HttpError } from '../tasks/validation.js'
import { avatarUpload, requireAvatarImage } from './avatar.js'
import { createRateLimiter } from '../security.js'
import { sendEmail, verificationEmail, passwordResetEmail } from '../email.js'

const router = Router()
const authLimit = Number(process.env.AUTH_RATE_LIMIT_MAX || 10)
const registrationLimiter = createRateLimiter({ name: 'registration', windowMs: 15 * 60 * 1000, maxRequests: authLimit })
const loginLimiter = createRateLimiter({ name: 'login', windowMs: 15 * 60 * 1000, maxRequests: authLimit })
const verificationLimiter = createRateLimiter({ name: 'email-verification', windowMs: 15 * 60 * 1000, maxRequests: 10 })
const hashCode = (userId, code) => createHash('sha256').update(`${userId}:${code}:${process.env.SESSION_SECRET || 'tracklap-email-verification'}`).digest('hex')
const hashRegistrationValue = (email, value) => createHash('sha256').update(`${email}:${value}:${process.env.SESSION_SECRET || 'tracklap-email-verification'}`).digest('hex')

router.post('/registration/send-code', registrationLimiter, async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(400, 'Enter a valid email address.')
  const [accounts] = await pool.execute('SELECT id FROM users WHERE email = ?', [email])
  if (accounts.length) throw new HttpError(409, 'An account with this email already exists. Sign in instead.')
  const [existing] = await pool.execute('SELECT TIMESTAMPDIFF(SECOND, sent_at, NOW()) AS seconds_since_sent FROM registration_email_codes WHERE email = ?', [email])
  if (existing[0] && Number(existing[0].seconds_since_sent) < 60) throw new HttpError(429, 'Wait one minute before requesting another code.')
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await sendEmail({ to:email, subject:'Your Tracklap verification code', ...verificationEmail(code) })
  await pool.execute(`INSERT INTO registration_email_codes (email, code_hash, expires_at, attempts, sent_at, verified_at, ticket_hash)
    VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0, NOW(), NULL, NULL)
    ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash), expires_at=VALUES(expires_at), attempts=0, sent_at=VALUES(sent_at), verified_at=NULL, ticket_hash=NULL`, [email, hashRegistrationValue(email, code)])
  response.json({ message:'Verification code sent.' })
})

router.post('/registration/verify-code', verificationLimiter, async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const code = typeof request.body?.code === 'string' ? request.body.code.trim() : ''
  if (!email || !/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter your email and the 6-digit code.')
  const [rows] = await pool.execute('SELECT code_hash, (expires_at > NOW()) AS is_valid, attempts FROM registration_email_codes WHERE email = ?', [email])
  const entry = rows[0]
  if (!entry || entry.attempts >= 5 || !Number(entry.is_valid) || hashRegistrationValue(email, code) !== entry.code_hash) {
    if (entry && entry.attempts < 5) await pool.execute('UPDATE registration_email_codes SET attempts=attempts+1 WHERE email=?', [email])
    throw new HttpError(400, 'The verification code is invalid or expired.')
  }
  const ticket = randomBytes(32).toString('hex')
  await pool.execute('UPDATE registration_email_codes SET verified_at=NOW(), ticket_hash=?, expires_at=DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE email=?', [hashRegistrationValue(email, ticket), email])
  response.json({ message:'Email verified. Complete your account details.', registrationTicket:ticket })
})

async function issueVerification(user) {
  const [existing] = await pool.execute('SELECT sent_at FROM email_verification_codes WHERE user_id = ?', [user.id])
  if (existing[0] && Date.now() - new Date(`${existing[0].sent_at}Z`).getTime() < 60_000) throw new HttpError(429, 'Wait one minute before requesting another code.')
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await sendEmail({ to:user.email, subject:'Verify your Tracklap email', ...verificationEmail(code) })
  await pool.execute(`INSERT INTO email_verification_codes (user_id, code_hash, expires_at, attempts, sent_at)
    VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE), 0, UTC_TIMESTAMP())
    ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash), expires_at=VALUES(expires_at), attempts=0, sent_at=VALUES(sent_at)`, [user.id, hashCode(user.id, code)])
}

router.post('/register', registrationLimiter, async (request, response) => {
  const { name, email, password } = validateRegistration(request.body)
  if (request.body?.confirmPassword !== password) throw new HttpError(400, 'Passwords do not match.')
  const ticket = typeof request.body?.registrationTicket === 'string' ? request.body.registrationTicket : ''
  if (!/^[a-f0-9]{64}$/.test(ticket)) throw new HttpError(403, 'Verify your email before creating your account.')
  const [verification] = await pool.execute('SELECT email, verified_at, ticket_hash, (expires_at > NOW()) AS is_valid FROM registration_email_codes WHERE email=?', [email])
  const verified = verification[0]
  if (!verified?.verified_at || !Number(verified.is_valid) || verified.ticket_hash !== hashRegistrationValue(email, ticket)) throw new HttpError(403, 'Email verification expired. Request a new code.')
  const passwordCredentials = await hashPassword(password)
  let result
  try {
    ;[result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, password_salt, email_verified) VALUES (?, ?, ?, ?, TRUE)',
      [name, email, passwordCredentials.hash, passwordCredentials.salt],
    )
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'An account with this email already exists.')
    throw error
  }

  const newUser = { id: result.insertId, name, email }
  await pool.execute('DELETE FROM registration_email_codes WHERE email=?', [email])
  response.status(201).json({ message:'Account created successfully. You can sign in now.', user:newUser })
})

router.post('/verify-email', verificationLimiter, async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const code = typeof request.body?.code === 'string' ? request.body.code.trim() : ''
  if (!email || !/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter your email and the 6-digit verification code.')
  const [rows] = await pool.execute('SELECT id, email_verified FROM users WHERE email = ?', [email])
  const account = rows[0]
  if (!account) throw new HttpError(400, 'The verification code is invalid or expired.')
  if (account.email_verified) return response.json({ message:'Email already verified. You can sign in.' })
  const [codes] = await pool.execute('SELECT code_hash, expires_at, attempts FROM email_verification_codes WHERE user_id = ?', [account.id])
  const entry = codes[0]
  if (!entry || entry.attempts >= 5 || new Date(`${entry.expires_at}Z`).getTime() < Date.now() || hashCode(account.id, code) !== entry.code_hash) {
    if (entry && entry.attempts < 5) await pool.execute('UPDATE email_verification_codes SET attempts = attempts + 1 WHERE user_id = ?', [account.id])
    throw new HttpError(400, 'The verification code is invalid or expired.')
  }
  await pool.execute('UPDATE users SET email_verified = TRUE WHERE id = ?', [account.id])
  await pool.execute('DELETE FROM email_verification_codes WHERE user_id = ?', [account.id])
  response.json({ message:'Email verified. You can sign in now.' })
})

router.post('/resend-verification', verificationLimiter, async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const [rows] = await pool.execute('SELECT id, email, email_verified FROM users WHERE email = ?', [email])
  if (rows[0] && !rows[0].email_verified) await issueVerification(rows[0])
  response.json({ message:'If the account needs verification, a new code has been sent.' })
})

router.post('/login', loginLimiter, async (request, response) => {
  const { email, password } = validateLogin(request.body)
  const [rows] = await pool.execute(
    'SELECT id, name, email, password_hash, password_salt, avatar_updated_at, email_verified FROM users WHERE email = ?',
    [email],
  )
  const account = rows[0]
  if (!account || !await verifyPassword(password, account.password_salt, account.password_hash)) {
    throw new HttpError(401, 'Email or password is incorrect.')
  }
  if (!account.email_verified) throw new HttpError(403, 'Verify your email before signing in.')

  await createSession(account.id, response, account)
  response.json({ user: formatSessionUser(account) })
})

router.post('/password/forgot', verificationLimiter, async (request,response)=>{
  const email=typeof request.body?.email==='string'?request.body.email.trim().toLowerCase():''
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400,'Enter a valid email address.')
  const [accounts]=await pool.execute('SELECT id,email FROM users WHERE email=?',[email])
  if(accounts.length){
    const code=String(randomInt(0,1_000_000)).padStart(6,'0')
    await sendEmail({to:email,subject:'Reset your Tracklap password',...passwordResetEmail(code)})
    await pool.execute(`INSERT INTO password_reset_codes (email,code_hash,expires_at,attempts,sent_at) VALUES (?, ?, DATE_ADD(NOW(),INTERVAL 10 MINUTE),0,NOW()) ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash),expires_at=VALUES(expires_at),attempts=0,sent_at=VALUES(sent_at)`,[email,hashRegistrationValue(email,code)])
  }
  response.json({message:'If an account exists, a password reset code has been sent.'})
})

router.post('/password/reset', verificationLimiter, async (request,response)=>{
  const email=typeof request.body?.email==='string'?request.body.email.trim().toLowerCase():''
  const code=typeof request.body?.code==='string'?request.body.code.trim():''
  const password=request.body?.password
  if(!/^\d{6}$/.test(code)||typeof password!=='string'||password.length<8||password.length>128) throw new HttpError(400,'Enter the 6-digit code and a password between 8 and 128 characters.')
  const [rows]=await pool.execute('SELECT code_hash,(expires_at>NOW()) AS is_valid,attempts FROM password_reset_codes WHERE email=?',[email])
  const reset=rows[0]
  if(!reset||!Number(reset.is_valid)||reset.attempts>=5||hashRegistrationValue(email,code)!==reset.code_hash){
    if(reset&&reset.attempts<5) await pool.execute('UPDATE password_reset_codes SET attempts=attempts+1 WHERE email=?',[email])
    throw new HttpError(400,'The reset code is invalid or expired.')
  }
  const credentials=await hashPassword(password)
  const connection=await pool.getConnection()
  try{await connection.beginTransaction();await connection.execute('UPDATE users SET password_hash=?,password_salt=? WHERE email=?',[credentials.hash,credentials.salt,email]);await connection.execute('DELETE FROM user_sessions WHERE user_id=(SELECT id FROM users WHERE email=?)',[email]);await connection.execute('DELETE FROM password_reset_codes WHERE email=?',[email]);await connection.commit()}catch(error){await connection.rollback();throw error}finally{connection.release()}
  response.json({message:'Password updated. Sign in with your new password.'})
})

router.post('/password/change',requireAuth,async(request,response)=>{
  const {currentPassword,newPassword}=request.body??{}
  if(typeof currentPassword!=='string'||typeof newPassword!=='string'||newPassword.length<8||newPassword.length>128)throw new HttpError(400,'Enter your current password and a new password between 8 and 128 characters.')
  const [rows]=await pool.execute('SELECT password_hash AS passwordHash,password_salt AS passwordSalt FROM users WHERE id=?',[request.user.id])
  if(!rows[0]||!await verifyPassword(currentPassword,rows[0].passwordSalt,rows[0].passwordHash))throw new HttpError(400,'Current password is incorrect.')
  const credentials=await hashPassword(newPassword)
  await pool.execute('UPDATE users SET password_hash=?,password_salt=? WHERE id=?',[credentials.hash,credentials.salt,request.user.id])
  response.json({message:'Password changed successfully.'})
})

router.delete('/account',requireAuth,async(request,response)=>{
  const password=request.body?.password
  if(typeof password!=='string'||!password)throw new HttpError(400,'Enter your password to delete this account.')
  const [rows]=await pool.execute('SELECT password_hash AS passwordHash,password_salt AS passwordSalt FROM users WHERE id=?',[request.user.id])
  if(!rows[0]||!await verifyPassword(password,rows[0].passwordSalt,rows[0].passwordHash))throw new HttpError(400,'Password is incorrect.')
  await pool.execute('DELETE FROM users WHERE id=?',[request.user.id])
  response.clearCookie('tracklap_session',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'})
  response.json({success:true})
})

router.get('/me', requireAuth, (request, response) => {
  response.json({ user: getSessionUser(request) })
})

router.get('/avatar', requireAuth, async (request, response) => {
  const [rows] = await pool.execute(
    'SELECT avatar_data, avatar_mime_type FROM users WHERE id = ?',
    [request.user.id],
  )
  const avatar = rows[0]
  if (!avatar?.avatar_data || !avatar.avatar_mime_type) throw new HttpError(404, 'No profile picture is set.')

  response.set({
    'Cache-Control': 'private, max-age=300',
    'Content-Type': avatar.avatar_mime_type,
    'X-Content-Type-Options': 'nosniff',
  })
  response.send(avatar.avatar_data)
})

router.post('/avatar', requireAuth, avatarUpload, async (request, response) => {
  const mimeType = requireAvatarImage(request.file)
  await pool.execute(
    'UPDATE users SET avatar_data = ?, avatar_mime_type = ?, avatar_updated_at = UTC_TIMESTAMP() WHERE id = ?',
    [request.file.buffer, mimeType, request.user.id],
  )
  const [rows] = await pool.execute(
    'SELECT id, name, email, avatar_updated_at FROM users WHERE id = ?',
    [request.user.id],
  )
  response.json({ user: formatSessionUser(rows[0]) })
})

router.delete('/avatar', requireAuth, async (request, response) => {
  await pool.execute(
    'UPDATE users SET avatar_data = NULL, avatar_mime_type = NULL, avatar_updated_at = NULL WHERE id = ?',
    [request.user.id],
  )
  response.json({
    user: { id: request.user.id, name: request.user.name, email: request.user.email, avatarUrl: null },
  })
})

router.post('/logout', async (request, response) => {
  await clearSession(request, response)
  response.json({ success: true })
})

export default router
