// ==UserScript==
// @name         Chzzk VOD Bookmark System V1.1
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  html 클래스(theme_dark) 감지 로직 적용, 테마 변경 시 UI 강제 리렌더링, 디자인 가이드 100% 준수
// @author       SeoYuri
// @match        https://chzzk.naver.com/*
// @icon         https://ssl.pstatic.net/static/nng/glive/icon/favicon.png
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/godung-s/chzzk-vod-bookmark/main/chzzk_bookmark.user.js
// @downloadURL  https://raw.githubusercontent.com/godung-s/chzzk-vod-bookmark/main/chzzk_bookmark.user.js
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================================
    // 1. 설정 (Config)
    // =========================================================================
    const CONFIG = {
        storageKey: 'chzzk_bookmarks_v1',
        activeColor: '#ffd700',
        inactiveColor: '#cccccc',
        fabSize: '50px',
        listWidth: '420px',
        maxListHeight: 450,
        invalidThumbKeywords: ['favicon', 'ogtag', 'data:image/svg', 'glive/icon'],
        maxPageSearch: 100,
        iframeLoadWait: 2000
    };

    // =========================================================================
    // 2. 스타일 (CSS)
    // =========================================================================
   const css = `
        /* [1] 즐겨찾기 버튼 (기본: 다크모드) */
        .cz-bookmark-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%; /* 항상 원형 */
            margin-right: 8px;
            background-color: #2E3033; /* [수정됨] 요청하신 다크모드 배경색 */
            border: none; /* 테두리 없음 */
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .cz-bookmark-btn:hover { background-color: rgba(255, 255, 255, 0.15); }
        .cz-bookmark-btn.active svg { fill: ${CONFIG.activeColor}; stroke: ${CONFIG.activeColor}; }
        .cz-bookmark-btn.inactive svg { fill: none; stroke: ${CONFIG.inactiveColor}; }

        /* [라이트 모드] 즐겨찾기 버튼 */
        body.cz-light-mode .cz-bookmark-btn {
            background-color: #E1E1E5 !important;
        }
        body.cz-light-mode .cz-bookmark-btn:hover {
            background-color: #d0d0d5 !important;
        }
        body.cz-light-mode .cz-bookmark-btn.inactive svg {
            stroke: #2E3033 !important; /* 진한 회색 */
        }


        /* [2] 플로팅 버튼 (FAB) */
        .cz-fab-wrapper {
            position: fixed;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            bottom: 30px;
            right: 30px;
            user-select: none;
            touch-action: none;
        }

        .cz-fab-btn {
            width: ${CONFIG.fabSize};
            height: ${CONFIG.fabSize};
            border-radius: 50%;
            background-color: #141517; /* 기본 다크 */
            border: 2px solid ${CONFIG.activeColor};
            color: ${CONFIG.activeColor};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            box-shadow: 0 4px 15px rgba(0,0,0,0.6);
            transition: background-color 0.2s, transform 0.1s;
            position: relative;
            z-index: 11;
        }

        /* [라이트 모드] 플로팅 버튼 배경 흰색 강제 */
        body.cz-light-mode .cz-fab-btn {
            background-color: #ffffff !important;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15) !important;
        }

        .cz-fab-btn:active { cursor: grabbing; transform: scale(0.95); }
        .cz-fab-btn svg { width: 26px; height: 26px; fill: ${CONFIG.activeColor} !important; stroke: ${CONFIG.activeColor} !important; }


        /* [3] 리스트 패널 */
        .cz-list-panel {
            position: absolute;
            width: ${CONFIG.listWidth};
            max-height: ${CONFIG.maxListHeight}px;
            background-color: #191b1e;
            border: 1px solid #333;
            border-radius: 12px;
            display: none;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 8px 30px rgba(0,0,0,0.8);
            cursor: default;
            z-index: 10;
            color: #eee;
        }
        .cz-list-panel.show { display: flex; }

        .cz-list-header {
            flex-shrink: 0;
            padding: 12px 15px;
            background: #232529;
            font-size: 13px;
            font-weight: bold;
            color: #ddd;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
        }

        .cz-list-item {
            display: flex;
            padding: 12px;
            border-bottom: 1px solid #2a2c30;
            text-decoration: none;
            color: #eee;
            position: relative;
            cursor: pointer;
            flex-shrink: 0;
        }
        .cz-list-item:hover { background-color: #232529; }

        .cz-video-title { font-size: 14px; font-weight: 600; margin-bottom: 6px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: #fff; }
        .cz-video-meta { font-size: 11px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* [라이트 모드] 리스트 패널 */
        body.cz-light-mode .cz-list-panel {
            background-color: #ffffff !important;
            border: 1px solid #E1E1E5 !important;
            box-shadow: 0 8px 30px rgba(0,0,0,0.15) !important;
            color: #222 !important;
        }
        body.cz-light-mode .cz-list-header {
            background: #f8f9fa !important;
            color: #222 !important;
            border-bottom: 1px solid #e0e0e0 !important;
        }
        body.cz-light-mode .cz-list-item {
            border-bottom: 1px solid #f0f0f0 !important;
            color: #222 !important;
        }
        body.cz-light-mode .cz-list-item:hover {
            background-color: #f5f6f8 !important;
        }
        body.cz-light-mode .cz-video-title { color: #1E1E23 !important; }
        body.cz-light-mode .cz-video-meta { color: #767678 !important; }

        /* 스크롤바 */
        #cz-list-content { flex: 1; overflow-y: auto; overscroll-behavior: contain; }
        #cz-list-content::-webkit-scrollbar { width: 8px; }
        #cz-list-content::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
        #cz-list-content::-webkit-scrollbar-track { background: #191b1e; }

        body.cz-light-mode #cz-list-content::-webkit-scrollbar-thumb { background: #ccc !important; }
        body.cz-light-mode #cz-list-content::-webkit-scrollbar-track { background: #f9f9f9 !important; }

        /* 기타 공통 */
        .cz-thumb-box { width: 140px; height: 78px; flex-shrink: 0; margin-right: 14px; border-radius: 6px; overflow: hidden; background-color: #000; display: flex; align-items: center; justify-content: center; }
        .cz-thumb-img { width: 100%; height: 100%; object-fit: cover; }
        .cz-info-box { flex: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden; }

        /* [기본: 다크모드] 삭제 버튼 */
        .cz-delete-btn {
            position: absolute; top: 6px; right: 6px;
            width: 20px; height: 20px;
            background: rgba(0,0,0,0.6); /* 다크모드용 반투명 검정 */
            color: #ff5555;
            border-radius: 4px;
            display: none;
            align-items: center; justify-content: center;
            font-size: 14px; cursor: pointer; z-index: 10;
        }

        /* [라이트 모드] 삭제 버튼 오버라이드 */
        body.cz-light-mode .cz-delete-btn {
            background: #E1E1E5 !important; /* 라이트모드용 밝은 회색 */
        }

        .cz-list-item:hover .cz-delete-btn { display: flex; }

        /* 호버 시 빨간색 반전 (공통) */
        .cz-delete-btn:hover { background: #ff5555 !important; color: white !important; }

        .cz-empty-msg { padding: 30px; text-align: center; color: #777; font-size: 13px; }

        .cz-pos-top-left { bottom: 60px; right: 0; }
        .cz-pos-bottom-left { top: 60px; right: 0; }
        .cz-pos-top-right { bottom: 60px; left: 0; }
        .cz-pos-bottom-right { top: 60px; left: 0; }

        iframe[id^="cz-crawler-"] { position: fixed; top: -9999px; left: -9999px; width: 1024px; height: 768px; visibility: hidden; pointer-events: none; z-index: -1; }
    `;
    GM_addStyle(css);

    // =========================================================================
    // 3. 헬퍼 함수
    // =========================================================================
    function isValidThumbnail(url) {
        if (!url || typeof url !== 'string') return false;
        return !CONFIG.invalidThumbKeywords.some(keyword => url.includes(keyword));
    }

    function convertRelativeDate(text) {
        if (!text) return '';
        const now = new Date();
        const num = parseInt(text.replace(/[^0-9]/g, '')) || 0;

        if (text.includes('분 전') || text.includes('방금')) { /* 오늘 */ }
        else if (text.includes('시간 전')) now.setHours(now.getHours() - num);
        else if (text.includes('일 전')) now.setDate(now.getDate() - num);
        else if (text.includes('어제')) now.setDate(now.getDate() - 1);
        else if (text.includes('주 전')) now.setDate(now.getDate() - (num * 7));
        else if (text.includes('달 전') || text.includes('개월 전')) now.setMonth(now.getMonth() - num);
        else if (text.includes('년 전')) now.setFullYear(now.getFullYear() - num);
        else return text;

        return `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}`;
    }

    const delay = ms => new Promise(res => setTimeout(res, ms));

    // =========================================================================
    // 4. Crawler Logic
    // =========================================================================
    const Crawler = {
        getChannelId: () => {
            const infoLink = document.querySelector('a[class*="video_information_link"]');
            if (infoLink) {
                const href = infoLink.getAttribute('href');
                const match = href.match(/([a-f0-9]{32})/);
                if (match && match[1]) return match[1];
            }
            try {
                const jsonLd = document.querySelector('script[type="application/ld+json"]');
                if (jsonLd) {
                    const ld = JSON.parse(jsonLd.innerText);
                    if (ld.author && ld.author.url) {
                        const match = ld.author.url.match(/([a-f0-9]{32})/);
                        if (match && match[1]) return match[1];
                    }
                }
            } catch(e) {}
            const allLinks = document.querySelectorAll('a[href]');
            for (const link of allLinks) {
                const href = link.getAttribute('href');
                const match = href.match(/\/([a-f0-9]{32})(\/|$)/);
                if (match && match[1]) return match[1];
            }
            return null;
        },
        scanPageWithIframe: async (url, videoId, iframeId) => {
            return new Promise((resolve) => {
                const oldFrame = document.getElementById(iframeId);
                if (oldFrame) oldFrame.remove();
                const iframe = document.createElement('iframe');
                iframe.id = iframeId;
                iframe.src = url;
                document.body.appendChild(iframe);
                iframe.onload = async () => {
                    await delay(CONFIG.iframeLoadWait);
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        if (doc.body.innerText.includes('등록된 동영상이 없습니다') || doc.querySelector('.no_content_text')) {
                            resolve('END'); return;
                        }
                        const targetLink = doc.querySelector(`a[href*="/video/${videoId}"]`);
                        if (targetLink) {
                            const img = targetLink.querySelector('img[class*="video_card_image"]');
                            if (img && img.src) { resolve(img.src); return; }
                        }
                    } catch (e) {}
                    resolve(null);
                };
                setTimeout(() => resolve(null), 12000);
            });
        },
        startJob: async (videoId) => {
            const channelId = Crawler.getChannelId();
            if (!channelId) {
                await delay(1500);
                const retryId = Crawler.getChannelId();
                if (!retryId) return;
                Crawler.runPagination(retryId, videoId);
            } else {
                Crawler.runPagination(channelId, videoId);
            }
        },
        runPagination: async (channelId, videoId) => {
            for (let page = 1; page <= CONFIG.maxPageSearch; page++) {
                const urlLatest = `https://chzzk.naver.com/${channelId}/videos?sortType=LATEST&page=${page}`;
                const urlPopular = `https://chzzk.naver.com/${channelId}/videos?sortType=POPULAR&page=${page}`;
                const [resultLatest, resultPopular] = await Promise.all([
                    Crawler.scanPageWithIframe(urlLatest, videoId, 'cz-crawler-latest'),
                    Crawler.scanPageWithIframe(urlPopular, videoId, 'cz-crawler-popular')
                ]);
                const foundUrl = (resultLatest && resultLatest.startsWith('http')) ? resultLatest : (resultPopular && resultPopular.startsWith('http')) ? resultPopular : null;
                if (foundUrl) {
                    Storage.update({ id: videoId, thumbnail: foundUrl });
                    Crawler.cleanup();
                    return;
                }
                if (resultLatest === 'END' && resultPopular === 'END') break;
            }
            Crawler.cleanup();
        },
        cleanup: () => {
            const f1 = document.getElementById('cz-crawler-latest');
            const f2 = document.getElementById('cz-crawler-popular');
            if(f1) f1.remove(); if(f2) f2.remove();
        }
    };

    // =========================================================================
    // 5. 메타데이터 추출
    // =========================================================================
    function extractVideoMetadata() {
        if (!window.location || !window.location.pathname) return null;
        const path = window.location.pathname;
        if (!path.startsWith('/video/')) return null;
        const videoId = path.split('/').pop();

        let data = {
            id: videoId,
            title: '',
            channel: '',
            thumbnail: '',
            date: '',
            views: '조회수 정보 없음',
            url: window.location.href,
            timestamp: Date.now()
        };

        const fullTitle = document.title ? document.title.replace(' - CHZZK', '').trim() : '';
        const separatorIndex = fullTitle.indexOf(' - ');
        if (separatorIndex !== -1) {
            data.channel = fullTitle.substring(0, separatorIndex).trim();
            data.title = fullTitle.substring(separatorIndex + 3).trim();
        } else { data.title = fullTitle; }

        const viewEl = document.querySelector('strong[class*="video_information_count"]');
        if (viewEl) {
            data.views = viewEl.innerText.trim();
        } else {
            const xpath = document.evaluate("//*[contains(text(), '조회수')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (xpath.singleNodeValue) {
                data.views = xpath.singleNodeValue.textContent.trim();
            }
        }

        let foundDate = false;
        try {
            const jsonLd = document.querySelector('script[type="application/ld+json"]');
            if (jsonLd) {
                const ld = JSON.parse(jsonLd.innerText);
                if (ld.uploadDate) {
                    const d = new Date(ld.uploadDate);
                    data.date = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
                    foundDate = true;
                }
            }
        } catch(e) {}

        if (!foundDate) {
            const dateSpan = document.querySelector('span[class*="video_information_count"]');
            if (dateSpan) {
                const txt = dateSpan.textContent.trim();
                data.date = convertRelativeDate(txt);
                foundDate = true;
            }
        }

        if (foundDate && data.date && !data.date.includes('20')) {
             const thisYear = new Date().getFullYear();
             data.date = `${thisYear}. ${data.date}`;
        }

        return data;
    }

    // =========================================================================
    // 6. 저장소
    // =========================================================================
    const Storage = {
        get: () => { try { return JSON.parse(localStorage.getItem(CONFIG.storageKey)) || []; } catch { return []; } },
        save: (list) => { localStorage.setItem(CONFIG.storageKey, JSON.stringify(list)); UI.renderList(); },
        add: (meta) => {
            const list = Storage.get();
            const filtered = list.filter(item => item.id !== meta.id);
            filtered.push(meta);
            Storage.save(filtered);
            if (!isValidThumbnail(meta.thumbnail)) Crawler.startJob(meta.id);
        },
        update: (meta) => {
            let list = Storage.get();
            const index = list.findIndex(item => item.id === meta.id);
            if (index !== -1) {
                if (meta.thumbnail && meta.thumbnail.startsWith('http')) list[index].thumbnail = meta.thumbnail;
                Storage.save(list);
            }
        },
        remove: (id) => { Storage.save(Storage.get().filter(item => item.id !== id)); },
        has: (id) => Storage.get().some(item => item.id === id)
    };

    // =========================================================================
    // 7. UI
    // =========================================================================
    const UI = {
        createFAB: () => {
            if (document.querySelector('.cz-fab-wrapper')) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'cz-fab-wrapper';

            const panel = document.createElement('div');
            panel.className = 'cz-list-panel cz-pos-top-left';
            panel.innerHTML = `<div class="cz-list-header"><span>내 즐겨찾기</span><span><span id="cz-count" style="color:${CONFIG.activeColor}">0</span>개</span></div><div id="cz-list-content"></div>`;

            const fab = document.createElement('div');
            fab.className = 'cz-fab-btn';
            fab.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

            wrapper.appendChild(panel);
            wrapper.appendChild(fab);
            document.body.appendChild(wrapper);

            const updatePanelPosition = () => {
                const fabRect = wrapper.getBoundingClientRect();
                const header = document.querySelector('[class*="header_container"]');
                const sidebar = document.querySelector('[class*="aside_content"]');
                let isTopBlocked = false; let isLeftBlocked = false;
                const buffer = -5;
                if (header) {
                    const headerRect = header.getBoundingClientRect();
                    if (fabRect.top - CONFIG.maxListHeight < headerRect.bottom + buffer) isTopBlocked = true;
                } else if (fabRect.top < CONFIG.maxListHeight + buffer) { isTopBlocked = true; }
                if (sidebar) {
                    const sidebarRect = sidebar.getBoundingClientRect();
                    if (fabRect.right - parseInt(CONFIG.listWidth) < sidebarRect.right + buffer) isLeftBlocked = true;
                } else if (fabRect.left < parseInt(CONFIG.listWidth) + buffer) { isLeftBlocked = true; }
                panel.classList.remove('cz-pos-top-left', 'cz-pos-bottom-left', 'cz-pos-top-right', 'cz-pos-bottom-right');
                if (isTopBlocked && isLeftBlocked) panel.classList.add('cz-pos-bottom-right');
                else if (isTopBlocked) panel.classList.add('cz-pos-bottom-left');
                else if (isLeftBlocked) panel.classList.add('cz-pos-top-right');
                else panel.classList.add('cz-pos-top-left');
                wrapper.style.alignItems = isLeftBlocked ? 'flex-start' : 'flex-end';
            };

            let isDragging = false; let isPressed = false; let shiftX = 0, shiftY = 0;
            fab.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                isPressed = true; isDragging = false;
                const rect = wrapper.getBoundingClientRect();
                shiftX = e.clientX - rect.left; shiftY = e.clientY - rect.top;
                wrapper.style.bottom = 'auto'; wrapper.style.right = 'auto';
                wrapper.style.left = `${rect.left}px`; wrapper.style.top = `${rect.top}px`;
                document.body.style.userSelect = 'none';
            });
            document.addEventListener('mousemove', (e) => {
                if (!isPressed) return;
                e.preventDefault();
                wrapper.style.left = `${e.clientX - shiftX}px`; wrapper.style.top = `${e.clientY - shiftY}px`;
                isDragging = true; panel.classList.remove('show');
            });
            document.addEventListener('mouseup', () => {
                if (isPressed) { isPressed = false; document.body.style.userSelect = ''; if (isDragging) updatePanelPosition(); }
            });
            fab.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!isDragging) { updatePanelPosition(); panel.classList.toggle('show'); }
            });
            document.addEventListener('click', (e) => { if (!wrapper.contains(e.target)) panel.classList.remove('show'); });
            window.addEventListener('resize', () => { if (panel.classList.contains('show')) updatePanelPosition(); });
            UI.renderList();
        },
        renderList: () => {
            const content = document.getElementById('cz-list-content');
            const count = document.getElementById('cz-count');
            if (!content) return;
            const list = Storage.get();
            if(count) count.innerText = list.length;
            content.innerHTML = '';
            if (list.length === 0) { content.innerHTML = '<div class="cz-empty-msg">저장된 영상이 없습니다.</div>'; return; }
            list.forEach(item => {
                const row = document.createElement('div');
                row.className = 'cz-list-item';
                let thumbSrc = 'https://ssl.pstatic.net/static/nng/glive/icon/favicon.png';
                if (item.thumbnail && typeof item.thumbnail === 'string' && !item.thumbnail.startsWith('data:')) thumbSrc = item.thumbnail;
                const channelName = item.channel ? `${item.channel}` : '채널미상';
                const dateStr = item.date ? `${item.date}` : '';
                const viewStr = item.views ? `${item.views}` : '';
                const metaString = `${channelName} | ${dateStr} | ${viewStr}`;
                const addedDate = new Date(item.timestamp || Date.now());
                const addedDateStr = `${addedDate.getFullYear()}. ${addedDate.getMonth() + 1}. ${addedDate.getDate()}.`;
                row.innerHTML = `
                    <div class="cz-thumb-box"><img src="${thumbSrc}" class="cz-thumb-img"></div>
                    <div class="cz-info-box">
                        <div class="cz-video-title" title="${item.title}">${item.title}</div>
                        <div class="cz-video-meta" title="${metaString}">${metaString}</div>
                        <div class="cz-video-meta">${addedDateStr}에 추가함</div>
                    </div>
                    <div class="cz-delete-btn" title="삭제">✕</div>
                `;
                row.onclick = (e) => { if(!e.target.classList.contains('cz-delete-btn')) window.open(item.url, '_blank'); };
                row.querySelector('.cz-delete-btn').onclick = (e) => {
                    e.stopPropagation();
                    if(confirm('삭제하시겠습니까?')) {
                        Storage.remove(item.id);
                        const curId = window.location.pathname.split('/').pop();
                        if(curId === item.id) { const btn = document.querySelector('.cz-bookmark-btn'); if(btn) { btn.classList.remove('active'); btn.classList.add('inactive'); } }
                    }
                };
                content.appendChild(row);
            });
        },

        injectBookmarkButton: () => {
            const path = (window.location && window.location.pathname) ? window.location.pathname : '';
            if (!path.startsWith('/video/')) return;

            let btn = document.querySelector('.cz-bookmark-btn');

            if (!btn) {
                const buttons = Array.from(document.querySelectorAll('button'));
                const targetBtn = buttons.find(b => b.textContent.includes('팔로잉') || b.textContent.includes('팔로우'));
                if (!targetBtn) return;

                btn = document.createElement('div');
                btn.className = 'cz-bookmark-btn inactive';
                btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

                btn.onclick = () => {
                    const currentId = window.location.pathname.split('/').pop();
                    if (Storage.has(currentId)) {
                        Storage.remove(currentId);
                    } else {
                        const meta = extractVideoMetadata();
                        if(meta) Storage.add(meta);
                    }
                    UI.updateButtonState();
                };

                targetBtn.parentNode.insertBefore(btn, targetBtn);
            }
            UI.updateButtonState();
        },

        updateButtonState: () => {
            const btn = document.querySelector('.cz-bookmark-btn');
            if (!btn) return;
            const currentVideoId = window.location.pathname.split('/').pop();
            if (Storage.has(currentVideoId)) {
                btn.classList.add('active');
                btn.classList.remove('inactive');
            } else {
                btn.classList.remove('active');
                btn.classList.add('inactive');
            }
        }
    };

    // =========================================================================
    // 8. 실행 (테마 감지 로직 개선)
    // =========================================================================
    function init() {
        UI.createFAB();

        // [테마 감지 로직 - class 기반]
        const checkTheme = () => {
            const html = document.documentElement;
            // <html> 태그의 class에 'theme_dark'가 있으면 다크모드, 없으면 라이트모드
            const isDarkMode = html.classList.contains('theme_dark');

            if (isDarkMode) {
                document.body.classList.add('cz-dark-mode');
                document.body.classList.remove('cz-light-mode');
            } else {
                document.body.classList.add('cz-light-mode');
                document.body.classList.remove('cz-dark-mode');
            }

            // 모든 UI 요소 삭제 후 재생성 (강제 리렌더링)
            const oldFab = document.querySelector('.cz-fab-wrapper');
            if (oldFab) oldFab.remove();
            UI.createFAB();

            const oldBtn = document.querySelector('.cz-bookmark-btn');
            if (oldBtn) oldBtn.remove();

            if (window.location.pathname.startsWith('/video/')) {
                UI.injectBookmarkButton();
            }
        };

        // MutationObserver: class 속성 변화 감지
        const themeObserver = new MutationObserver(checkTheme);
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        // 초기 실행
        checkTheme();

        // 페이지 이동 감지
        let lastPath = window.location.pathname;
        const observer = new MutationObserver(() => {
            const currentPath = window.location.pathname;
            if (currentPath !== lastPath) {
                lastPath = currentPath;
                if (currentPath.startsWith('/video/')) UI.injectBookmarkButton();
            } else {
                if (currentPath.startsWith('/video/')) UI.injectBookmarkButton();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        if (window.location.pathname.startsWith('/video/')) {
            setTimeout(UI.injectBookmarkButton, 1000);
            setTimeout(UI.injectBookmarkButton, 3000);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();