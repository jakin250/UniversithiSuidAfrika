const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const users = new Map();
const sessions = new Map();
const forumPosts = [];
const bookstoreListings = [];
const marketplaceListings = [];

function send(res, code, data, type='application/json') { res.writeHead(code, {'Content-Type': type}); res.end(type==='application/json'?JSON.stringify(data):data); }
function parseBody(req){return new Promise(r=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{r(JSON.parse(b||'{}'))}catch{r({})}})})}
function auth(req){ const token = req.headers['x-session-token']; if(!token||!sessions.has(token)) return null; return sessions.get(token); }

const server = http.createServer(async (req,res)=>{
  if(req.url.startsWith('/api/')){
    if(req.method==='POST' && req.url==='/api/login'){
      const {email}=await parseBody(req);
      if(!/@[^@]+\.(ac\.za|edu)$/i.test(email||'')) return send(res,400,{error:'Valid student email required'});
      const user={email:email.toLowerCase(),name:email.split('@')[0]}; users.set(user.email,user);
      const token=crypto.randomBytes(18).toString('hex'); sessions.set(token,user);
      return send(res,200,{token,user});
    }
    const user=auth(req); if(!user) return send(res,401,{error:'Unauthorized'});
    if(req.method==='GET' && req.url==='/api/forum/posts') return send(res,200,{posts:forumPosts});
    if(req.method==='POST' && req.url==='/api/forum/posts'){ const b=await parseBody(req); const p={id:Date.now(),title:b.title,body:b.body,tag:b.tag||'General',author:`u/${user.name}`,time:'Just now',votes:1,comments:0,tagType:'general',userVote:0}; forumPosts.unshift(p); return send(res,200,{post:p}); }
    if(req.method==='GET' && req.url==='/api/bookstore/listings') return send(res,200,{listings:bookstoreListings});
    if(req.method==='POST' && req.url==='/api/bookstore/listings'){ const b=await parseBody(req); const l={id:Date.now(),title:b.title,author:b.author,isbn:b.isbn||'N/A',category:b.category||'General',condition:b.condition||'good',conditionLabel:'Good',price:Number(b.price||0),originalPrice:Number(b.originalPrice||b.price||0),image:'https://via.placeholder.com/300x400/4f86c6/ffffff?text=Listing',seller:user.name,rating:5,sales:0,location:b.location||'Campus',description:b.description||'',date:'Just now'}; bookstoreListings.unshift(l); return send(res,200,{listing:l}); }
    if(req.method==='GET' && req.url==='/api/marketplace/listings') return send(res,200,{listings:marketplaceListings});
    if(req.method==='POST' && req.url==='/api/marketplace/listings'){ const b=await parseBody(req); const l={id:Date.now(),title:b.title,price:`R${b.price}`,location:b.location||'Campus',time:'Just now',image:'📦',badge:'NEW'}; marketplaceListings.unshift(l); return send(res,200,{listing:l}); }
    return send(res,404,{error:'Not found'});
  }
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(process.cwd(), reqPath.replace(/^\//,''));
  if(!fs.existsSync(filePath)) return send(res,404,'Not found','text/plain');
  const ext = path.extname(filePath); send(res,200,fs.readFileSync(filePath), MIME[ext]||'text/plain');
});
server.listen(3000,()=>console.log('Server on http://localhost:3000'));
