require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { Pool } = require('pg')

const app = express()
app.use(cors())
app.use(express.json())

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function ensureSchema(){
  await pool.query(`CREATE TABLE IF NOT EXISTS docs (
    id SERIAL PRIMARY KEY,
    title TEXT DEFAULT 'Untitled',
    content TEXT DEFAULT '',
    updated_at TIMESTAMP DEFAULT now()
  )`)
}

ensureSchema().catch(err=>{console.error('schema error',err)})

app.get('/docs', async (req,res)=>{
  try{
    const r = await pool.query('SELECT id, title, updated_at FROM docs ORDER BY updated_at DESC')
    res.json(r.rows)
  }catch(e){res.status(500).send(e.message)}
})

app.get('/docs/:id', async (req,res)=>{
  try{
    const r = await pool.query('SELECT * FROM docs WHERE id=$1',[req.params.id])
    if(r.rowCount===0) return res.status(404).send('not found')
    res.json(r.rows[0])
  }catch(e){res.status(500).send(e.message)}
})

app.post('/docs', async (req,res)=>{
  try{
    const {title,content} = req.body || {}
    const r = await pool.query('INSERT INTO docs (title,content,updated_at) VALUES ($1,$2,now()) RETURNING *',[title||'Untitled',content||''])
    res.json(r.rows[0])
  }catch(e){res.status(500).send(e.message)}
})

app.put('/docs/:id', async (req,res)=>{
  try{
    const fields = []
    const vals = []
    let idx = 1
    if(req.body.title !== undefined){fields.push(`title=$${idx++}`); vals.push(req.body.title)}
    if(req.body.content !== undefined){fields.push(`content=$${idx++}`); vals.push(req.body.content)}
    if(fields.length===0) return res.status(400).send('no fields')
    // always update timestamp
    fields.push(`updated_at=now()`)
    const q = `UPDATE docs SET ${fields.join(',')} WHERE id=$${idx} RETURNING *`
    vals.push(req.params.id)
    const r = await pool.query(q, vals)
    if(r.rowCount===0) return res.status(404).send('not found')
    res.json(r.rows[0])
  }catch(e){res.status(500).send(e.message)}
})

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

io.on('connection', socket=>{
  socket.on('join', ({id})=>{
    socket.join('doc:'+id)
  })
  socket.on('edit', async ({id, content})=>{
    try{
      const r = await pool.query('UPDATE docs SET content=$1, updated_at=now() WHERE id=$2 RETURNING *',[content, id])
      const doc = r.rows[0]
      io.to('doc:'+id).emit('remoteEdit', {id, content: doc.content, updated_at: doc.updated_at})
    }catch(e){console.error('edit err',e)}
  })
})

const port = process.env.PORT || 3000
server.listen(port, ()=>console.log('server listening on', port))
