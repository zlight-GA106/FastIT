let appConfig = {};
let currentActiveArea = null;
let isLayoutMode = false;
let dragEl = null;
let startX = 0, startY = 0;

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
});

// 全局监听点击与拖拽
document.addEventListener('mousedown', (e) => {
    const target = e.target.closest('.editable-area');
    if (target && !isLayoutMode) {
        currentActiveArea = target;
        updateAreaLockBtnState();
    }
    if (isLayoutMode && target && !e.target.classList.contains('delete-btn')) {
        dragEl = target;
        const rect = dragEl.getBoundingClientRect();
        const paperRect = document.getElementById('receipt-paper').getBoundingClientRect();
        
        if (window.getComputedStyle(dragEl).position !== 'absolute') {
            dragEl.style.position = 'absolute';
            dragEl.style.left = (rect.left - paperRect.left) + 'px';
            dragEl.style.top = (rect.top - paperRect.top) + 'px';
            dragEl.style.width = dragEl.offsetWidth + 'px';
        }
        startX = e.clientX - dragEl.offsetLeft;
        startY = e.clientY - dragEl.offsetTop;
        e.preventDefault(); 
    }
});

document.addEventListener('mousemove', (e) => {
    if (isLayoutMode && dragEl) {
        dragEl.style.left = (e.clientX - startX) + 'px';
        dragEl.style.top = (e.clientY - startY) + 'px';
    }
});

document.addEventListener('mouseup', () => { dragEl = null; });

async function loadConfig() {
    try {
        const response = await fetch('config.conf?t=' + new Date().getTime());
        if (!response.ok) throw new Error('网络请求失败');
        let textData = await response.text();
        textData = textData.replace(/^\uFEFF/, '').trim();
        appConfig = JSON.parse(textData);

        if (appConfig.defaultPaperMode) {
            const paperSelect = document.getElementById('paperMode');
            if (paperSelect) {
                paperSelect.value = appConfig.defaultPaperMode;
                togglePaperMode();
            }
        }

        const selector = document.getElementById('templateSelector');
        selector.innerHTML = '';
        if (appConfig.templates && appConfig.templates.length > 0) {
            appConfig.templates.forEach(tpl => {
                const opt = document.createElement('option');
                opt.value = tpl.path;
                opt.innerText = tpl.name;
                if(tpl.path === appConfig.defaultTemplate) opt.selected = true;
                selector.appendChild(opt);
            });
            loadSelectedTemplate();
        } else {
            applyConfigDataToDOM();
        }
    } catch (error) {
        alert("系统启动失败！请检查 config.conf 格式是否正确。");
    }
}

async function loadSelectedTemplate() {
    const path = document.getElementById('templateSelector').value;
    if(!path) return;
    try {
        const tplResponse = await fetch(path + '?t=' + new Date().getTime());
        if (tplResponse.ok) {
            const tplHtml = await tplResponse.text();
            document.getElementById('receipt-paper').innerHTML = tplHtml;
            applyConfigDataToDOM();
            showToast("✅ 模板已加载");
        }
    } catch (e) {
        console.warn("读取模板出错", e);
    }
}

function applyConfigDataToDOM() {
    const elShopName = document.getElementById('conf-shopName');
    const elReceiptTitle = document.getElementById('conf-receiptTitle');
    const elFooterText = document.getElementById('conf-footerText');
    const elBgText = document.getElementById('bg-text-layer');

    if(elShopName) elShopName.innerText = appConfig.shopName || "默认店铺";
    
    // 核心修改：如果模板里原本就是“加载中...”或者是全空的，才用 config 的值。
    // 如果其他部门导入模板时，标题已经改成了“教务处维修单”，就不要去覆盖它！
    if(elReceiptTitle && (elReceiptTitle.innerText.includes("加载中...") || elReceiptTitle.innerText.trim() === "")) {
        elReceiptTitle.innerText = appConfig.receiptTitle || "结账单";
    }
    
    if(elFooterText) elFooterText.innerText = appConfig.footerText || "";
    if(elBgText && elBgText.innerText.includes("加载中...")) elBgText.innerText = appConfig.bgText || "";
    
    // 如果 paper 还没有自定义字号，才应用默认字号
    const paper = document.getElementById('receipt-paper');
    if (!paper.style.fontSize) {
        paper.style.fontSize = appConfig.defaultFontSize || "14px";
    }
    document.getElementById('fontSize').value = appConfig.defaultFontSize || "14px";
    paper.style.fontFamily = appConfig.fontFamily || "sans-serif";
}

function showToast(msg, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, duration);
}

function togglePaperMode() {
    const mode = document.getElementById('paperMode').value;
    document.getElementById('receipt-paper').className = `receipt-paper mode-${mode}`;
}

function toggleLayoutMode() {
    isLayoutMode = !isLayoutMode;
    const paper = document.getElementById('receipt-paper');
    const btn = document.getElementById('layoutBtn');
    
    if (isLayoutMode) {
        paper.classList.add('layout-active');
        btn.innerText = "💾 保存排版布局";
        btn.classList.replace('btn-warning', 'btn-primary');
        document.querySelectorAll('.editable-area').forEach(el => {
            el.contentEditable = "false"; 
            
            // 核心修改：如果是带有 'non-deletable' 标签的区块（如标题），不添加红色删除按钮
            if(!el.classList.contains('non-deletable') && !el.querySelector('.delete-btn')) {
                const delBtn = document.createElement('span');
                delBtn.className = 'delete-btn no-print';
                delBtn.innerText = 'X';
                delBtn.onclick = function() { if(confirm("确定要删除这个区域吗？")) el.remove(); };
                el.appendChild(delBtn);
            }
        });
        showToast("📐 拖拽模式已开启，可自由移动或删除区块");
    } else {
        paper.classList.remove('layout-active');
        btn.innerText = "📐 开启自由排版";
        btn.classList.replace('btn-primary', 'btn-warning');
        document.querySelectorAll('.editable-area').forEach(el => {
            if(!el.classList.contains('locked-element')) el.contentEditable = "true";
            const delBtn = el.querySelector('.delete-btn');
            if(delBtn) delBtn.remove();
        });
        showToast("✅ 排版已固定，恢复文字编辑状态");
    }
}

function addEditableArea() {
    const paper = document.getElementById('receipt-paper');
    const footer = paper.querySelector('.footer');
    const newArea = document.createElement('div');
    newArea.className = 'editable-area';
    newArea.contentEditable = !isLayoutMode ? "true" : "false";
    newArea.innerHTML = "<div>在此输入新内容...</div>";
    
    if (footer) {
        paper.insertBefore(newArea, footer);
    } else {
        paper.appendChild(newArea);
    }

    if(isLayoutMode) { toggleLayoutMode(); toggleLayoutMode(); }
}

function addTableArea() {
    const colCountStr = prompt("请输入要生成的表格列数（数字）：", "3");
    if (!colCountStr) return;
    const colCount = parseInt(colCountStr);
    if (isNaN(colCount) || colCount <= 0) {
        showToast("请输入有效的数字！");
        return;
    }

    let ths = "";
    let tds = "";
    for(let i=1; i<=colCount; i++) {
        ths += `<th>项目${i}</th>`;
        tds += `<td>数据</td>`;
    }

    const paper = document.getElementById('receipt-paper');
    const footer = paper.querySelector('.footer');
    const newArea = document.createElement('div');
    newArea.className = 'editable-area';
    newArea.contentEditable = !isLayoutMode ? "true" : "false";
    newArea.innerHTML = `
        <table border="1">
            <tr>${ths}</tr>
            <tr>${tds}</tr>
        </table>`;
    
    if (footer) {
        paper.insertBefore(newArea, footer);
    } else {
        paper.appendChild(newArea);
    }

    if(isLayoutMode) { toggleLayoutMode(); toggleLayoutMode(); }
}

function changeFontSize() {
    const size = document.getElementById('fontSize').value;
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
        document.execCommand("fontSize", false, "7");
        const fontElements = document.getElementsByTagName("font");
        for (let i = 0; i < fontElements.length; ++i) {
            if (fontElements[i].size == "7") {
                fontElements[i].removeAttribute("size");
                fontElements[i].style.fontSize = size;
            }
        }
    } else if (currentActiveArea && !isLayoutMode) {
        currentActiveArea.style.fontSize = size;
        showToast("已修改当前区域字号");
    }
}

function changeBgStyle() {
    const opacityValue = document.getElementById('bgOpacity').value;
    const sizeValue = document.getElementById('bgSize').value;
    const bgLayer = document.getElementById('bg-text-layer');
    if(bgLayer) {
        bgLayer.style.color = `rgba(0, 0, 0, ${opacityValue})`;
        bgLayer.style.fontSize = `${sizeValue}px`;
    }
}

function toggleAreaLock() {
    if (!currentActiveArea || isLayoutMode) {
        showToast("请先点击选中一个虚线区域再操作");
        return;
    }
    if (currentActiveArea.classList.contains('locked-element')) {
        const pwd = prompt("请输入解锁密码：");
        if (pwd === appConfig.unlockPassword) {
            currentActiveArea.classList.remove('locked-element');
            currentActiveArea.contentEditable = "true";
            showToast("✅ 该区域已解锁");
            updateAreaLockBtnState();
        } else if (pwd !== null) alert("密码错误！");
    } else {
        currentActiveArea.classList.add('locked-element');
        currentActiveArea.contentEditable = "false";
        showToast("🔒 该区域已锁定");
        updateAreaLockBtnState();
    }
}

function updateAreaLockBtnState() {
    const btn = document.getElementById('areaLockBtn');
    if (!currentActiveArea) return;
    if (currentActiveArea.classList.contains('locked-element')) {
        btn.innerText = '🔓 解锁选中区';
        btn.className = 'btn-warning';
    } else {
        btn.innerText = '🔒 锁定选中区';
        btn.className = ''; 
    }
}

function toggleBgLock() {
    const bg = document.getElementById('bg-text-layer');
    const btn = document.getElementById('lockBtn');
    if(!bg) return;
    if (bg.classList.contains('locked')) {
        const pwd = prompt("请输入解锁密码：");
        if (pwd === appConfig.unlockPassword) {
            bg.classList.remove('locked');
            bg.contentEditable = "true";
            btn.innerText = "🔒 锁定背景水印";
            btn.classList.replace('btn-warning', 'btn-primary');
        } else if (pwd !== null) alert("密码错误！");
    } else {
        bg.classList.add('locked');
        bg.contentEditable = "false";
        btn.innerText = "🔓 解锁背景水印";
        btn.classList.replace('btn-primary', 'btn-warning');
    }
}

function generateImage(callback) {
    if(isLayoutMode) {
        showToast("请先点击[保存排版布局]退出排版模式！");
        return;
    }

    const receipt = document.getElementById('receipt-paper');
    const isA4 = receipt.classList.contains('mode-a4');
    const editAreas = document.querySelectorAll('.editable-area');
    
    editAreas.forEach(el => {
        el.dataset.oldOutline = el.style.outline;
        el.dataset.oldBg = el.style.backgroundColor;
        el.style.outline = 'none';
        el.style.backgroundColor = 'transparent';
        el.classList.remove('locked-element'); 
    });

    const absoluteWidth = isA4 ? 794 : 384; 
    const absoluteHeight = receipt.scrollHeight; 

    const cloneNode = receipt.cloneNode(true);
    cloneNode.style.width = absoluteWidth + 'px';
    cloneNode.style.height = absoluteHeight + 'px';
    cloneNode.style.maxWidth = 'none'; 
    cloneNode.style.margin = '0';

    const xmlSerializer = new XMLSerializer();
    const xhtml = xmlSerializer.serializeToString(cloneNode);

    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${absoluteWidth}" height="${absoluteHeight}">
        <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'SimHei', sans-serif; background: white; width: ${absoluteWidth}px; height: ${absoluteHeight}px; padding: 20px; box-sizing: border-box; font-size: ${appConfig.defaultFontSize || '14px'}; line-height: 1.5; margin: 0;">
                ${xhtml}
            </div>
        </foreignObject>
    </svg>`;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = absoluteWidth;
        canvas.height = absoluteHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, absoluteWidth, absoluteHeight);
        ctx.drawImage(img, 0, 0);
        
        editAreas.forEach(el => {
            el.style.outline = el.dataset.oldOutline;
            el.style.backgroundColor = el.dataset.oldBg;
            if (el.contentEditable === "false") el.classList.add('locked-element');
        });
        
        callback(canvas.toDataURL('image/jpeg', 1.0), isA4 ? 'A4' : '58mm');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
}

function printReceipt() {
    showToast("正在处理打印任务...");
    generateImage(function(base64Data, modeStr) {
        fetch('/print', {
            method: 'POST',
            headers: { 'Print-Mode': modeStr },
            body: base64Data
        })
        .then(response => {
            if(response.ok) showToast(`✅ 已通过 ${modeStr} 模式发送至服务器！`, 3000);
            else showToast("❌ 服务器接收失败", 3000);
        }).catch(err => {
            showToast("❌ 网络错误", 3000);
        });
    });
}

function downloadPNG() {
    generateImage(function(base64Data) {
        const a = document.createElement('a');
        a.href = base64Data;
        a.download = `工单_${new Date().getTime()}.jpg`;
        a.click();
        showToast("✅ 已保存到本地");
    });
}

function insertTimestamp() {
    const now = new Date();
    const timeStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日${now.getHours()}时${now.getMinutes().toString().padStart(2, '0')}分`;
    if (!currentActiveArea) return;
    if (currentActiveArea.classList.contains('locked-element')) {
        showToast("区域已锁定，无法插入！");
        return;
    }
    currentActiveArea.focus();
    if (!document.execCommand('insertText', false, timeStr)) {
        currentActiveArea.innerText += timeStr;
    }
}

function exportTemplate() {
    if(isLayoutMode) toggleLayoutMode(); 
    const paper = document.getElementById('receipt-paper').cloneNode(true);
    paper.querySelectorAll('.locked-element').forEach(el => el.classList.remove('locked-element'));

    const blob = new Blob([paper.innerHTML], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const isA4 = document.getElementById('paperMode').value === 'a4';
    a.download = isA4 ? 'template_a4.html' : 'template_58.html'; 
    a.click();
    showToast("📤 模板已导出");
}

function importTemplate(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('receipt-paper').innerHTML = e.target.result;
        applyConfigDataToDOM();
        showToast("✅ 外部模板导入成功");
        event.target.value = ''; 
    };
    reader.readAsText(file);
}