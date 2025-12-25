/**
 * 北京鸽哨数字记忆展示系统 - 核心逻辑
 */

let db = null; // 存储 assets.json 数据
const globalAudio = document.getElementById('global-audio');
let currentActiveAudioUrl = '';
let audioFadeInterval = null;
let currentRouteId = '';
let currentNodeAudioUrl = '';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1523419400524-b65e0b9c6c9b?auto=format&fit=crop&w=800&q=50';

function safeList(arr) {
    return Array.isArray(arr) ? arr : [];
}

function textOrFallback(value, fallback = '待补充') {
    if (value === undefined || value === null || value === '') return fallback;
    return value;
}

function bindImgFallback(imgEl) {
    if (!imgEl) return;
    imgEl.onerror = () => { imgEl.src = FALLBACK_IMG; };
}

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('assets.json');
        db = await response.json();
        renderSite();
        initScrollSpy();
        initSearch();
        renderMemories();
        globalAudio.addEventListener('error', () => {
            alert('音频加载失败，请稍后再试或检查网络。');
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    } catch (e) {
        console.error("加载 assets.json 失败:", e);
        alert('数据加载失败，请刷新重试。');
    }
});

function renderSite() {
    if(!db) return;
    renderCraftSection();
    renderSoundSection();
    renderCultureSection();
    initInteractiveSection();
}

function renderCraftSection() {
    const filterBox = document.getElementById('filter-chips');
    const categories = ['全部', ...new Set(safeList(db.exhibits).map(ex => ex.category))];
    filterBox.innerHTML = categories.map(cat => `
        <button onclick="filterExhibits('${cat}', this)" class="filter-btn px-6 py-1.5 rounded-full border-2 border-[#a13d2d]/20 text-[#a13d2d] text-sm font-bold hover:border-[#a13d2d] transition-all">
            ${cat}
        </button>
    `).join('');
    const allBtn = filterBox.querySelector('.filter-btn');
    if(allBtn) allBtn.classList.add('bg-[#a13d2d]', 'text-white', 'border-[#a13d2d]');
    renderExhibits(safeList(db.exhibits));

    const vrBtn = document.getElementById('vr-hall-btn');
    if (vrBtn && db.siteConfig && db.siteConfig.vrHallUrl) {
        vrBtn.onclick = () => {
            window.open(db.siteConfig.vrHallUrl, '_blank');
        };
    }

    const stepBox = document.getElementById('craft-steps');
    stepBox.innerHTML = safeList(db.craftSteps).map((step, idx) => `
        <div class="text-center group">
            <div class="w-16 h-16 bg-[#a13d2d] text-white rounded-full flex items-center justify-center mx-auto mb-5 font-bold text-xl shadow-lg group-hover:scale-110 transition-transform">
                ${idx + 1}
            </div>
            <h4 class="font-bold text-base mb-2 text-[#a13d2d]">${textOrFallback(step.title)}</h4>
            <p class="text-xs text-gray-500 leading-relaxed px-2 opacity-80">${textOrFallback(step.text)}</p>
        </div>
    `).join('');

    const craftVideo = document.getElementById('craft-video');
    if (craftVideo && db.siteConfig && db.siteConfig.craftVideoUrl) {
        craftVideo.src = db.siteConfig.craftVideoUrl;
    }
}

function renderExhibits(items) {
    const grid = document.getElementById('exhibit-grid');
    grid.innerHTML = items.map(ex => `
        <div class="paper-card rounded-2xl p-4 md:p-5 flex flex-col cursor-pointer animate-fadeIn" onclick="openExhibitModal('${ex.id}')">
            <div class="aspect-square bg-[#f9f7f5] mb-4 md:mb-5 overflow-hidden rounded-xl relative group shadow-inner">
                <img src="${textOrFallback(ex.thumbUrl, FALLBACK_IMG)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" onerror="this.src='${FALLBACK_IMG}'" alt="${textOrFallback(ex.name)}">
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                    <span class="text-white text-xs border-2 border-white px-4 py-1.5 rounded-full font-bold">赏玩细节</span>
                </div>
            </div>
            <h3 class="font-bold text-lg md:text-xl mb-1 text-[#332b2b] break-words">${textOrFallback(ex.name)}</h3>
            <p class="text-xs text-[#a13d2d] font-serif mb-3 md:mb-4 italic break-words">${textOrFallback(ex.soundType)}</p>
            <div class="mt-auto flex flex-wrap gap-2">
                <span class="text-[10px] bg-gray-50 px-2 py-1 rounded-md text-gray-400 font-bold border border-gray-100 break-words">${textOrFallback(ex.category)}</span>
            </div>
        </div>
    `).join('');
}

function filterExhibits(cat, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('bg-[#a13d2d]', 'text-white', 'border-[#a13d2d]'));
    btn.classList.add('bg-[#a13d2d]', 'text-white', 'border-[#a13d2d]');
    if (cat === '全部') renderExhibits(safeList(db.exhibits));
    else renderExhibits(safeList(db.exhibits).filter(ex => ex.category === cat));
}

function openExhibitModal(id) {
    const ex = safeList(db.exhibits).find(e => e.id === id);
    if (!ex) return;
    const modal = document.getElementById('exhibit-modal');
    document.getElementById('modal-name').innerText = textOrFallback(ex.name);
    document.getElementById('modal-category').innerText = textOrFallback(ex.category);
    document.getElementById('modal-sound').innerText = `音律特征：${textOrFallback(ex.soundType)}`;
    document.getElementById('modal-desc').innerText = textOrFallback(ex.description);
    const modelEl = document.getElementById('modal-model');
    const sketchfabEl = document.getElementById('modal-sketchfab');
    const modelUrl = textOrFallback(ex.modelUrl, '');
    
    // 检测是否是 Sketchfab 链接
    if (modelUrl.includes('sketchfab.com') || modelUrl.includes('skfb.ly')) {
        // 隐藏 model-viewer，显示 Sketchfab iframe
        modelEl.classList.add('hidden');
        sketchfabEl.classList.remove('hidden');
        
        // 如果已经是嵌入链接，直接使用
        if (modelUrl.includes('/embed')) {
            sketchfabEl.src = modelUrl;
        } else {
            // 转换链接为嵌入 URL
            let embedUrl = '';
            if (modelUrl.includes('sketchfab.com/models/')) {
                // 从完整链接提取模型ID
                const match = modelUrl.match(/sketchfab\.com\/models\/([^\/\?]+)/);
                if (match) {
                    embedUrl = `https://sketchfab.com/models/${match[1]}/embed`;
                }
            } else if (modelUrl.includes('skfb.ly/')) {
                // 短链接需要解析
                embedUrl = modelUrl.replace('skfb.ly/', 'sketchfab.com/models/').replace(/\/$/, '') + '/embed';
            }
            
            if (embedUrl) {
                sketchfabEl.src = embedUrl;
            } else {
                // 如果无法解析，使用原始链接
                sketchfabEl.src = modelUrl;
            }
        }
    } else {
        // 普通 GLB 文件，使用 model-viewer（如果将来需要）
        modelEl.classList.remove('hidden');
        sketchfabEl.classList.add('hidden');
        if (modelUrl) {
            modelEl.src = modelUrl;
        } else {
            modelEl.src = '';
        }
    }
    const audioBox = document.getElementById('modal-audio-list');
    const relatedAudios = safeList(db.audios).filter(a => safeList(ex.audioIds).includes(a.id)).slice(0, 1);
    audioBox.innerHTML = relatedAudios.map(a => `
        <button onclick="fadePlayAudio('${a.url}', '${a.name}')" class="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-white border-2 border-transparent hover:border-[#a13d2d]/20 rounded-xl transition-all text-left shadow-sm group">
            <div class="flex items-center gap-4">
                <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#a13d2d] shadow-sm group-hover:scale-110 transition-transform">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg>
                </div>
                <div>
                    <p class="text-sm font-bold text-[#332b2b]">${textOrFallback(a.name)}</p>
                    <p class="text-[10px] text-gray-400 font-medium">${textOrFallback(a.type)} · ${textOrFallback(a.region)}</p>
                </div>
            </div>
        </button>
    `).join('');
    const photoBox = document.getElementById('modal-photos');
    // 显示2张图片：封面thumbUrl + photoUrls的第一张
    const photos = [ex.thumbUrl, ...safeList(ex.photoUrls)].slice(0, 2).filter(url => url);
    photoBox.innerHTML = photos.length > 0 ? photos.map(url => `
        <div class="overflow-hidden rounded-xl aspect-video bg-gray-100"><img src="${textOrFallback(url, FALLBACK_IMG)}" class="w-full h-full object-cover" onerror="this.src='${FALLBACK_IMG}'"></div>
    `).join('') : `<div class="overflow-hidden rounded-xl aspect-video bg-gray-100 flex items-center justify-center text-gray-400">暂无图片</div>`;
    document.getElementById('modal-tags').innerHTML = safeList(ex.termIds).map(tid => {
        const t = safeList(db.terms).find(x => x.id === tid);
        return t ? `<span class="bg-[#a13d2d]/10 text-[#a13d2d] text-[10px] px-3 py-1 rounded-full font-bold"># ${t.term}</span>` : '';
    }).join('');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('exhibit-modal').classList.remove('active');
    document.body.style.overflow = 'auto';
    stopAudioWithFade();
}

function renderSoundSection() {
    const tabBox = document.getElementById('route-tabs');
    tabBox.innerHTML = safeList(db.routes).map((rt, idx) => `
        <button onclick="switchRoute('${rt.id}')" class="route-btn whitespace-nowrap px-8 py-2.5 rounded-full font-bold transition-all ${idx===0 ? 'bg-[#a13d2d] text-white shadow-lg' : 'bg-white/60 text-gray-400 border border-gray-200'}">
            ${rt.name}
        </button>
    `).join('');
    if(safeList(db.routes).length > 0) switchRoute(db.routes[0].id);
}

function switchRoute(id) {
    currentRouteId = id;
    const rt = safeList(db.routes).find(r => r.id === id);
    if (!rt) return;
    document.querySelectorAll('.route-btn').forEach(btn => {
        const isActive = btn.innerText.includes(rt.name);
        btn.classList.toggle('bg-[#a13d2d]', isActive);
        btn.classList.toggle('text-white', isActive);
    });
    document.getElementById('node-list').innerHTML = rt.nodes.map((node, idx) => `
        <button onclick="selectNode('${node.id}', this)" class="node-btn group w-full flex items-center gap-5 p-5 bg-white/40 hover:bg-white rounded-xl border-2 border-transparent hover:border-[#a13d2d]/20 transition-all text-left">
            <span class="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-[#a13d2d] group-hover:text-white text-xs flex items-center justify-center font-bold">${idx+1}</span>
            <span class="font-bold text-base text-gray-700">${node.name}</span>
        </button>
    `).join('');
}

function selectNode(nodeId, btn) {
    const rt = safeList(db.routes).find(r => r.id === currentRouteId) || { nodes: [] };
    const node = safeList(rt.nodes).find(n => n.id === nodeId) || {};
    const audio = safeList(db.audios).find(a => a.id === node.audioId);
    document.querySelectorAll('.node-btn').forEach(b => b.classList.remove('border-[#a13d2d]', 'bg-white'));
    btn.classList.add('border-[#a13d2d]', 'bg-white');
    document.getElementById('node-placeholder').classList.add('hidden');
    document.getElementById('node-content').classList.remove('hidden');
    document.getElementById('node-name').innerText = textOrFallback(node.name);
    document.getElementById('node-desc').innerText = textOrFallback(node.description);
    const img = document.getElementById('node-img');
    img.src = textOrFallback((safeList(node.photoUrls)[0]), FALLBACK_IMG);
    bindImgFallback(img);
    const tagBox = document.getElementById('node-tags');
    tagBox.innerHTML = safeList(node.tags).map(t => `<span class="px-3 py-1 bg-white/70 rounded-full text-xs text-[#a13d2d] border border-[#a13d2d]/20">${t}</span>`).join('');
    document.getElementById('node-audio-name').innerText = audio ? audio.name : '未知录音';
    currentNodeAudioUrl = audio ? audio.url : '';
}

function toggleNodeAudio() {
    if(currentNodeAudioUrl) fadePlayAudio(currentNodeAudioUrl, "声景节点音频");
}

function fadePlayAudio(url) {
    if (globalAudio.src.includes(url) && !globalAudio.paused) {
        stopAudioWithFade();
        return;
    }
    stopAudioWithFade(() => {
        globalAudio.src = url;
        globalAudio.volume = 0;
        globalAudio.play();
        let vol = 0;
        audioFadeInterval = setInterval(() => {
            vol += 0.1;
            if (vol >= 1) { globalAudio.volume = 1; clearInterval(audioFadeInterval); }
            else globalAudio.volume = vol;
        }, 100);
    });
}

function stopAudioWithFade(callback) {
    if (audioFadeInterval) clearInterval(audioFadeInterval);
    let vol = globalAudio.volume;
    audioFadeInterval = setInterval(() => {
        vol -= 0.2;
        if (vol <= 0) { globalAudio.volume = 0; globalAudio.pause(); clearInterval(audioFadeInterval); if (callback) callback(); }
        else globalAudio.volume = vol;
    }, 100);
}

function renderCultureSection() {
    // 从实际数据中提取唯一的group，排除虚构人物
    const allGroups = [...new Set(safeList(db.people).map(p => p.group).filter(g => g && !g.includes('虚构')))];
    const groups = allGroups.length > 0 ? allGroups : ['传承人', '名人与玩家', '文学记录者'];
    document.getElementById('people-tabs').innerHTML = groups.map((g, idx) => `
        <button onclick="filterPeople('${g}')" class="p-group-btn pb-4 text-base font-bold transition-all ${idx===0 ? 'text-[#a13d2d] border-b-4 border-[#a13d2d]' : 'text-gray-400 border-b-4 border-transparent'}">${g}</button>
    `).join('');
    if(groups.length > 0) filterPeople(groups[0]);
    document.getElementById('timeline-container').innerHTML = safeList(db.timeline).map(item => `
        <button onclick="openTimelineModal('${item.id}')" class="flex-shrink-0 w-72 p-8 bg-white/80 backdrop-blur-sm border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all text-left">
            <span class="text-[#a13d2d] font-bold text-sm block mb-2">${item.period}</span>
            <h4 class="font-bold text-xl mb-4 text-[#332b2b]">${item.title}</h4>
            <p class="text-xs text-gray-500 leading-relaxed font-light">${item.text}</p>
        </button>
    `).join('');
    renderTerms(safeList(db.terms));
    renderDialects(safeList(db.dialects));
    renderLiteratures(safeList(db.literatures));
}

function filterPeople(group) {
    // 过滤掉虚构人物，并按group匹配（支持部分匹配，因为group可能有不同格式）
    const filtered = safeList(db.people)
        .filter(p => p.group && !p.group.includes('虚构'))
        .filter(p => p.group === group || p.group.includes(group) || group.includes(p.group))
        .slice(0, 3); // 每组最多3个
    document.querySelectorAll('.p-group-btn').forEach(btn => {
        const isActive = btn.innerText === group || btn.innerText.includes(group);
        btn.classList.toggle('text-[#a13d2d]', isActive);
        btn.classList.toggle('border-[#a13d2d]', isActive);
    });
    document.getElementById('people-grid').innerHTML = filtered.length > 0 ? filtered.map(p => `
        <div class="bg-white p-6 rounded-2xl border border-gray-50 shadow-sm hover:shadow-xl transition-all group">
            <h4 class="font-bold text-xl md:text-2xl mb-2 text-[#332b2b] break-words">${textOrFallback(p.name)}</h4>
            <span class="text-[10px] bg-[#a13d2d] text-white px-2 py-0.5 rounded-md mb-4 inline-block font-bold break-words">${textOrFallback(p.group)}</span>
            <p class="text-sm text-gray-500 leading-relaxed mb-6 font-light break-words">${textOrFallback(p.description)}</p>
        </div>
    `).join('') : '<div class="col-span-full text-center text-gray-400 py-8">暂无数据</div>';
}

function renderTerms(list) {
    document.getElementById('term-list').innerHTML = list.map(t => `
        <div class="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <h4 class="font-bold text-[#a13d2d] mb-2 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-[#a13d2d]"></span>${t.term}</h4>
            <p class="text-xs text-gray-500 leading-relaxed">${t.definition}</p>
        </div>
    `).join('');
}

function renderDialects(list) {
    const box = document.getElementById('dialect-list');
    if (!box) return;
    box.innerHTML = list.map(d => `
        <div class="p-3 bg-white/70 rounded-xl border border-[#a13d2d]/10 flex justify-between items-start">
            <div>
                <p class="font-bold text-[#332b2b]">${d.phrase}</p>
                <p class="text-xs text-gray-600">${d.meaning}</p>
            </div>
            <span class="text-[11px] text-[#a13d2d] bg-[#a13d2d]/10 px-2 py-1 rounded-full">${d.note || ''}</span>
        </div>
    `).join('');
}

function renderLiteratures(list) {
    const container = document.getElementById('literature-list');
    if (!container) return;
    container.innerHTML = list.map(l => `
        <div class="bg-white/80 rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-[#a13d2d]">${l.type}</span>
                <span class="text-[10px] text-gray-400">${l.title}</span>
            </div>
            <p class="text-xs text-gray-600 leading-relaxed">${l.summary}</p>
            <div class="mt-1">
                ${safeList(l.images).slice(0,1).map(url => `
                    <div class="aspect-video rounded-xl overflow-hidden bg-gray-100">
                        <img src="${textOrFallback(url, FALLBACK_IMG)}" class="w-full h-full object-cover" onerror="this.src='${FALLBACK_IMG}'">
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function openTimelineModal(id) {
    const tl = safeList(db.timeline).find(t => t.id === id);
    if (!tl) return;
    document.getElementById('tl-period').innerText = textOrFallback(tl.period);
    document.getElementById('tl-title').innerText = textOrFallback(tl.title);
    document.getElementById('tl-detail').innerText = textOrFallback(tl.detail || tl.text);
    const imgBox = document.getElementById('tl-images');
    imgBox.innerHTML = safeList(tl.images).slice(0,3).map(url => `
        <div class="aspect-square rounded-xl overflow-hidden bg-gray-100">
            <img src="${textOrFallback(url, FALLBACK_IMG)}" class="w-full h-full object-cover" onerror="this.src='${FALLBACK_IMG}'">
        </div>
    `).join('');
    document.getElementById('timeline-modal').classList.add('active');
}

function closeTimelineModal() {
    document.getElementById('timeline-modal').classList.remove('active');
}

function initSearch() {
    document.getElementById('term-search').addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        renderTerms(safeList(db.terms).filter(t => t.term.toLowerCase().includes(val) || t.definition.toLowerCase().includes(val)));
    });
}

function initInteractiveSection() {
    const imgEl = document.getElementById('memory-image');
    const vidEl = document.getElementById('memory-video');
    if (imgEl) {
        imgEl.src = db.siteConfig && db.siteConfig.memoryImageUrl ? db.siteConfig.memoryImageUrl : FALLBACK_IMG;
        bindImgFallback(imgEl);
    }
    if (vidEl) {
        vidEl.src = db.siteConfig && db.siteConfig.memoryVideoUrl ? db.siteConfig.memoryVideoUrl : '';
    }
}
function generateDIY() {
    const material = document.getElementById('diy-material').value;
    const tone = document.getElementById('diy-tone').value;
    const scene = document.getElementById('diy-scene').value;
    const tips = {
        "雷音": "选择厚实葫芦或多筒组合，气道宽些，楼鸽大群飞更稳。",
        "蛉音": "孔径要小且圆滑，竹片要薄，近距离表演最抓耳。",
        "五音": "精细定音孔，互不抢频，适合巡游或节庆表演。"
    };
    document.getElementById('diy-result').innerText = `${scene} 环境推荐用 ${material} 做主体，追求「${tone}」时：${tips[tone] || '注意定音孔和气道的均衡。'}`;
}

async function generatePoster() {
    const canvas = document.getElementById('poster-canvas');
    const ctx = canvas.getContext('2d');
    const exId = document.getElementById('card-exhibit').value;
    const msg = document.getElementById('card-msg').value || "空中交响乐，京城灵动魂。";
    const ex = safeList(db.exhibits).find(e => e.id === exId);

    // 背景宣纸色
    ctx.fillStyle = "#f4efeb";
    ctx.fillRect(0, 0, 600, 800);
    
    // 双线边框
    ctx.strokeStyle = "#a13d2d";
    ctx.lineWidth = 15;
    ctx.strokeRect(20, 20, 560, 760);
    ctx.lineWidth = 2;
    ctx.strokeRect(35, 35, 530, 730);

    // 加载哨种图片
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = ex ? ex.thumbUrl : FALLBACK_IMG;
    const drawPoster = () => {
        ctx.drawImage(img, 70, 80, 460, 360);
        
        ctx.fillStyle = "#a13d2d";
        ctx.font = "bold 44px 'Noto Serif SC'";
        ctx.fillText(textOrFallback(ex?.name, '待补充'), 70, 510);
        
        ctx.fillStyle = "#666";
        ctx.font = "22px 'Noto Serif SC'";
        ctx.fillText(textOrFallback(ex?.category, '待补充') + " · " + textOrFallback(ex?.soundType, '待补充'), 70, 555);
        
        ctx.fillStyle = "#333";
        ctx.font = "italic 24px serif";
        ctx.fillText(msg, 70, 630);

        ctx.fillStyle = "rgba(161, 61, 45, 0.9)";
        ctx.beginPath();
        ctx.roundRect(420, 580, 100, 100, 15);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "50px serif";
        ctx.fillText("🐦", 442, 645); 
        ctx.font = "bold 14px serif";
        ctx.fillText("万音灵印", 442, 670);

        ctx.fillStyle = "#a13d2d";
        ctx.font = "bold 16px serif";
        ctx.fillText("北京鸽哨 · 数字记忆", 380, 735);

        const preview = document.getElementById('poster-preview');
        preview.innerHTML = `<img src="${canvas.toDataURL('image/png')}" class="w-full h-full object-contain animate-fadeIn" alt="海报预览">`;
        document.getElementById('download-btn').classList.remove('hidden');
    };
    img.onload = drawPoster;
    img.onerror = () => { img.src = FALLBACK_IMG; img.onload = drawPoster; };
}

function submitMemory(e) {
    e.preventDefault();
    const memories = JSON.parse(localStorage.getItem('whistle_memories') || '[]');
    memories.unshift({ id: Date.now(), text: document.getElementById('mem-text').value, place: document.getElementById('mem-place').value, date: new Date().toLocaleDateString() });
    localStorage.setItem('whistle_memories', JSON.stringify(memories));
    document.getElementById('mem-text').value = '';
    document.getElementById('mem-place').value = '';
    renderMemories();
}

function renderMemories() {
    const list = document.getElementById('memory-list');
    const memories = JSON.parse(localStorage.getItem('whistle_memories') || '[]');
    list.innerHTML = memories.map(m => `
        <div class="p-6 bg-[#f9f7f5] border-l-8 border-[#a13d2d] rounded-xl shadow-sm animate-fadeIn">
            <p class="text-base text-gray-700 mb-4 font-light leading-relaxed">“${m.text}”</p>
            <div class="flex justify-between items-center text-[10px] text-gray-400 font-bold tracking-widest">
                <span>📍 ${m.place || '老城根儿'}</span>
                <span>${m.date}</span>
            </div>
        </div>
    `).join('');
}

function initScrollSpy() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');
    window.addEventListener('scroll', () => {
        let current = "";
        sections.forEach(s => { if (pageYOffset >= s.offsetTop - 150) current = s.getAttribute("id"); });
        navLinks.forEach(l => l.classList.toggle('nav-active', l.getAttribute("href").includes(current)));
    });
}
