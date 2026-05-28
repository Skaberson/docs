const SERVER = (window.SERVER_URL || '').replace(/\/$/, '')
const statusEl = document.getElementById('status')
const docsEl = document.getElementById('docs')
const editor = document.getElementById('editor')
const titleInput = document.getElementById('title')
const darkToggle = document.getElementById('darkToggle')
const lastUpdated = document.getElementById('lastUpdated')
const searchInput = document.getElementById('search')

const createFab = document.getElementById('createFab')
const createModal = document.getElementById('createModal')
const modalTitle = document.getElementById('modalTitle')
const modalDesc = document.getElementById('modalDesc')
const modalCreate = document.getElementById('modalCreate')
const modalCancel = document.getElementById('modalCancel')

let socket = null
let currentDoc = null
let docsCache = []

function setStatus(s){statusEl.textContent = s}

function applyDarkMode(enabled){
	if(enabled) document.documentElement.classList.add('dark')
	else document.documentElement.classList.remove('dark')
	localStorage.setItem('dark', enabled? '1':'0')
}
darkToggle.addEventListener('click', ()=>applyDarkMode(localStorage.getItem('dark')!=='1'))
if(localStorage.getItem('dark')==='1') applyDarkMode(true)

async function api(path, opts={}){
	const res = await fetch(SERVER + path, opts)
	if(!res.ok) throw new Error(await res.text())
	return res.json()
}

function renderList(items){
	docsEl.innerHTML = ''
	items.forEach(d=>{
		const li = document.createElement('li')
		li.dataset.id = d.id
		li.innerHTML = `<div class="title">${escapeHtml(d.title||'Untitled')}</div><div class="meta">${d.updated_at?new Date(d.updated_at).toLocaleString():''}</div>`
		li.addEventListener('click', ()=>openDoc(d.id))
		if(currentDoc && currentDoc.id === d.id) li.classList.add('active')
		docsEl.appendChild(li)
	})
}

function escapeHtml(str){return String(str).replace(/[&<>"']/g, s=>({
	'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"
})[s])}

async function loadDocs(){
	try{
		const list = await api('/docs')
		docsCache = list
		renderList(list)
	}catch(e){console.error(e);}
}

createFab.addEventListener('click', openCreateModal)
modalCancel.addEventListener('click', closeCreateModal)
createModal.addEventListener('click', (e)=>{ if(e.target===createModal) closeCreateModal() })
modalCreate.addEventListener('click', async ()=>{
	const title = (modalTitle.value||'').trim() || 'Untitled'
	const content = (modalDesc.value||'').trim()
	try{
		const doc = await api('/docs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,content})})
		closeCreateModal()
		await loadDocs()
		openDoc(doc.id)
	}catch(e){console.error(e)}
})

function openCreateModal(){
	modalTitle.value=''
	modalDesc.value=''
	createModal.classList.add('show')
	createModal.setAttribute('aria-hidden','false')
	setTimeout(()=>modalTitle.focus(),120)
}
function closeCreateModal(){
	createModal.classList.remove('show')
	createModal.setAttribute('aria-hidden','true')
}

async function openDoc(id){
	try{
		const doc = await api('/docs/'+id)
		currentDoc = doc
		titleInput.value = doc.title || ''
		editor.innerText = doc.content || ''
		lastUpdated.textContent = doc.updated_at ? new Date(doc.updated_at).toLocaleString() : ''
		connectSocket(id)
		loadDocs()
	}catch(e){console.error(e)}
}

titleInput.addEventListener('input', debounce(async (e)=>{
	if(!currentDoc) return
	const title = e.target.value
	try{
		await api('/docs/'+currentDoc.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})})
		await loadDocs()
	}catch(err){console.error(err)}
}, 400))

editor.addEventListener('input', debounce(()=>{
	if(!currentDoc || !socket) return
	const content = editor.innerText
	socket.emit('edit', {id: currentDoc.id, content})
}, 300))

function connectSocket(docId){
	if(socket){
		try{socket.disconnect()}catch(e){}
	}
	if(!SERVER){setStatus('no-server');return}
	socket = io(SERVER, {transports:['websocket']})
	socket.on('connect', ()=>setStatus('connected'))
	socket.on('disconnect', ()=>setStatus('disconnected'))
	socket.on('remoteEdit', msg=>{
		if(!currentDoc) return
		if(msg.id !== currentDoc.id) return
		const pos = saveSelection()
		editor.innerText = msg.content
		restoreSelection(pos)
		lastUpdated.textContent = msg.updated_at ? new Date(msg.updated_at).toLocaleString() : ''
	})
	socket.emit('join', {id: docId})
}

// selection helpers (best-effort)
function saveSelection(){
	const sel = window.getSelection()
	if(!sel || sel.rangeCount===0) return null
	const range = sel.getRangeAt(0)
	return {start: range.startOffset}
}
function restoreSelection(pos){
	try{
		const sel = window.getSelection()
		sel.removeAllRanges()
		const range = document.createRange()
		range.setStart(editor.childNodes[0]||editor, pos?pos.start:0)
		range.collapse(true)
		sel.addRange(range)
	}catch(e){}
}

function debounce(fn, t){let h;return function(...a){clearTimeout(h);h=setTimeout(()=>fn.apply(this,a),t)}}

// search
searchInput.addEventListener('input', debounce((e)=>{
	const q = (e.target.value||'').toLowerCase()
	if(!q) return renderList(docsCache)
	renderList(docsCache.filter(d=> (d.title||'').toLowerCase().includes(q) ))
},200))

// initial load
loadDocs()
setStatus('idle')
