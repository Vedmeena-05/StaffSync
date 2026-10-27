import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

const userSchema = new mongoose.Schema({
  name:{type:String,required:true,trim:true}, email:{type:String,required:true,unique:true,lowercase:true,trim:true},
  password:{type:String,required:true,select:false}, role:{type:String,enum:['employee','manager','hr'],default:'employee'},
  department:{type:String,default:'General'}, jobTitle:{type:String,default:'Employee'}, phone:{type:String,default:''}
},{timestamps:true});
const User = mongoose.model('User',userSchema);
const attendanceSchema = new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},date:{type:String,required:true},checkIn:Date,checkOut:Date,status:{type:String,default:'Present'}},{timestamps:true});
attendanceSchema.index({user:1,date:1},{unique:true});
const Attendance = mongoose.model('Attendance',attendanceSchema);
const leaveSchema = new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},type:{type:String,required:true},startDate:{type:String,required:true},endDate:{type:String,required:true},reason:{type:String,required:true},status:{type:String,enum:['Pending','Approved','Rejected'],default:'Pending'},reviewedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}},{timestamps:true});
const Leave = mongoose.model('Leave',leaveSchema);
const announcementSchema = new mongoose.Schema({title:{type:String,required:true},message:{type:String,required:true},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},createdAt:{type:Date,default:Date.now}});
const Announcement = mongoose.model('Announcement',announcementSchema);
const trainingSchema = new mongoose.Schema({title:{type:String,required:true},description:{type:String,default:''},date:{type:String,default:''},link:{type:String,default:''}});
const Training = mongoose.model('Training',trainingSchema);

const safeUser = u => ({id:u._id,name:u.name,email:u.email,role:u.role,department:u.department,jobTitle:u.jobTitle,phone:u.phone});
const auth = async (req,res,next) => {
  try { const token=(req.headers.authorization||'').replace(/^Bearer\s+/,''); if(!token) return res.status(401).json({message:'Authentication required'});
    const data=jwt.verify(token,process.env.JWT_SECRET||'dev_only_change_me'); req.user=await User.findById(data.id); if(!req.user)return res.status(401).json({message:'User not found'}); next();
  } catch { res.status(401).json({message:'Invalid or expired token'}); }
};
const allow = (...roles) => (req,res,next) => roles.includes(req.user.role)?next():res.status(403).json({message:'You do not have permission for this action'});
app.get('/api/health',(req,res)=>res.json({status:'ok',service:'HRM API'}));
app.post('/api/auth/register',async(req,res)=>{try{
  const {name,email,password,department,jobTitle}=req.body;
  if(!name||!email||!password||password.length<8)return res.status(400).json({message:'Name, email, and password (at least 8 characters) are required'});
  if(await User.findOne({email}))return res.status(409).json({message:'Email is already registered'});
  const hash=await bcrypt.hash(password,12); const user=await User.create({name,email,password:hash,department,jobTitle,role:'employee'});
  const token=jwt.sign({id:user._id},process.env.JWT_SECRET||'dev_only_change_me',{expiresIn:'1d'}); res.status(201).json({token,user:safeUser(user)});
}catch(e){res.status(500).json({message:'Could not register account'});}});
app.post('/api/auth/login',async(req,res)=>{try{
  const {email,password}=req.body; const user=await User.findOne({email}).select('+password');
  if(!user||!await bcrypt.compare(password||'',user.password))return res.status(401).json({message:'Invalid email or password'});
  const token=jwt.sign({id:user._id},process.env.JWT_SECRET||'dev_only_change_me',{expiresIn:'1d'});res.json({token,user:safeUser(user)});
}catch{res.status(500).json({message:'Could not log in'});}});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:safeUser(req.user)}));
app.patch('/api/profile',auth,async(req,res)=>{try{const allowed=['name','department','jobTitle','phone'];for(const k of allowed)if(req.body[k]!==undefined)req.user[k]=req.body[k];await req.user.save();res.json({user:safeUser(req.user)});}catch{res.status(400).json({message:'Profile update failed'});}});

app.get('/api/employees',auth,allow('hr','manager'),async(req,res)=>{const filter=req.user.role==='manager'?{role:'employee',department:req.user.department}:{};res.json(await User.find(filter).sort({name:1}));});
app.post('/api/employees',auth,allow('hr'),async(req,res)=>{try{const {name,email,password,role,department,jobTitle}=req.body;if(!name||!email||!password||password.length<8)return res.status(400).json({message:'Name, email, and password (8+ characters) required'});const u=await User.create({name,email,password:await bcrypt.hash(password,12),role:['employee','manager','hr'].includes(role)?role:'employee',department,jobTitle});res.status(201).json(safeUser(u));}catch(e){res.status(400).json({message:'Unable to create employee. Check that the email is unique.'});}});
app.delete('/api/employees/:id',auth,allow('hr'),async(req,res)=>{if(String(req.user._id)===req.params.id)return res.status(400).json({message:'You cannot delete your own account'});await User.findByIdAndDelete(req.params.id);res.json({message:'Employee deleted'});});

app.get('/api/attendance',auth,async(req,res)=>{const filter=req.user.role==='hr'?{}:{user:req.user._id};const rows=await Attendance.find(filter).populate('user','name email department').sort({date:-1}).limit(200);res.json(rows);});
app.post('/api/attendance/checkin',auth,async(req,res)=>{const date=new Date().toISOString().slice(0,10);try{const row=await Attendance.create({user:req.user._id,date,checkIn:new Date()});res.status(201).json(row);}catch{res.status(409).json({message:'You have already checked in today'});}});
app.post('/api/attendance/checkout',auth,async(req,res)=>{const date=new Date().toISOString().slice(0,10);const row=await Attendance.findOne({user:req.user._id,date});if(!row)return res.status(404).json({message:'Check in first'});if(row.checkOut)return res.status(409).json({message:'You have already checked out'});row.checkOut=new Date();await row.save();res.json(row);});

app.get('/api/leaves',auth,async(req,res)=>{const filter=req.user.role==='hr'||req.user.role==='manager'?{}:{user:req.user._id};const rows=await Leave.find(filter).populate('user','name email department').populate('reviewedBy','name').sort({createdAt:-1});res.json(rows);});
app.post('/api/leaves',auth,async(req,res)=>{try{const {type,startDate,endDate,reason}=req.body;if(!type||!startDate||!endDate||!reason)return res.status(400).json({message:'All leave fields are required'});if(endDate<startDate)return res.status(400).json({message:'End date must be on or after start date'});res.status(201).json(await Leave.create({user:req.user._id,type,startDate,endDate,reason}));}catch{res.status(400).json({message:'Could not submit leave request'});}});
app.patch('/api/leaves/:id',auth,allow('hr','manager'),async(req,res)=>{const {status}=req.body;if(!['Approved','Rejected'].includes(status))return res.status(400).json({message:'Status must be Approved or Rejected'});const leave=await Leave.findById(req.params.id);if(!leave)return res.status(404).json({message:'Leave request not found'});if(req.user.role==='manager'){const employee=await User.findById(leave.user);if(!employee||employee.department!==req.user.department)return res.status(403).json({message:'This request is outside your team'});}leave.status=status;leave.reviewedBy=req.user._id;await leave.save();res.json(leave);});

app.get('/api/announcements',auth,async(req,res)=>res.json(await Announcement.find().sort({createdAt:-1})));
app.post('/api/announcements',auth,allow('hr'),async(req,res)=>{if(!req.body.title||!req.body.message)return res.status(400).json({message:'Title and message are required'});res.status(201).json(await Announcement.create({title:req.body.title,message:req.body.message,createdBy:req.user._id}));});
app.delete('/api/announcements/:id',auth,allow('hr'),async(req,res)=>{await Announcement.findByIdAndDelete(req.params.id);res.json({message:'Announcement deleted'});});
app.get('/api/trainings',auth,async(req,res)=>res.json(await Training.find().sort({date:1})));
app.post('/api/trainings',auth,allow('hr','manager'),async(req,res)=>{if(!req.body.title)return res.status(400).json({message:'Training title is required'});res.status(201).json(await Training.create({title:req.body.title,description:req.body.description||'',date:req.body.date||'',link:req.body.link||''}));});

app.get('/api/dashboard',auth,async(req,res)=>{const own={user:req.user._id};const [employees,attendanceToday,pendingLeaves,announcements,trainings]=await Promise.all([
  req.user.role==='hr'?User.countDocuments():req.user.role==='manager'?User.countDocuments({role:'employee',department:req.user.department}):Promise.resolve(1),
  Attendance.countDocuments({... (req.user.role==='hr'?{}:own),date:new Date().toISOString().slice(0,10)}),
  Leave.countDocuments({... (req.user.role==='employee'?own:{}),status:'Pending'}),
  Announcement.countDocuments(),Training.countDocuments()
]);res.json({employees,attendanceToday,pendingLeaves,announcements,trainings,role:req.user.role});});

app.use((err,req,res,next)=>{console.error(err);res.status(500).json({message:'Unexpected server error'});});
const port=process.env.PORT||5000;
mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/hrm').then(()=>app.listen(port,()=>console.log(`HRM API running on http://localhost:${port}`))).catch(err=>{console.error('MongoDB connection failed:',err.message);process.exit(1);});
