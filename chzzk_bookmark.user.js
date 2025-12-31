// ==UserScript==
// @name         Chzzk VOD/Clip Bookmark System V1.2
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  가짜 썸네일(ogtag) 차단 및 로딩 UI 유지, VOD 정보 지속적 DOM 파싱, 데이터 무결성 강화
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

    const CONFIG = {
        storageKey: 'chzzk_bookmarks_v1',
        activeColor: '#ffd700',
        inactiveColor: '#cccccc',
        fabSize: '50px',
        listWidth: '420px',
        maxListHeight: 450,
        invalidThumbKeywords: ['favicon', 'ogtag', 'data:image/svg', 'glive/icon'],
        maxPageSearch: 100,
        iframeLoadWait: 3000,
        timeoutSec: 60
    };

    // =========================================================================
    // 2. 스타일 (CSS) - V11.3 최종 (썸네일 고정, 위치 클래스, 라이트모드 완벽 대응)
    // =========================================================================
    const css = `
        /* [패널 헤더 버튼] */
        .cz-header-btn {
            font-size: 11px; cursor: pointer; margin-right: 8px; padding: 2px 8px;
            border-radius: 4px; background: transparent; border: 1px solid #555;
            color: #aaa; display: none; transition: all 0.2s; line-height: 1.5;
        }
        .cz-header-btn:hover { border-color: ${CONFIG.activeColor}; color: ${CONFIG.activeColor}; }
        .cz-header-btn.active { background-color: rgba(255, 215, 0, 0.15); border-color: ${CONFIG.activeColor}; color: ${CONFIG.activeColor}; font-weight: bold; }

        /* [VOD 버튼] */
        .cz-bookmark-btn { display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; z-index: 9999; border: none; width: 36px; height: 36px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.08); margin-right: 8px; }
        .cz-bookmark-btn:hover { background-color: rgba(255, 255, 255, 0.15); }
        .cz-bookmark-btn.active svg { fill: ${CONFIG.activeColor}; stroke: ${CONFIG.activeColor}; }
        .cz-bookmark-btn.inactive svg { fill: none; stroke: ${CONFIG.inactiveColor}; }

        /* [FAB 및 패널] */
        .cz-fab-wrapper { position: fixed; z-index: 10000; display: flex; flex-direction: column; align-items: flex-end; bottom: 30px; right: 30px; user-select: none; touch-action: none; }
        .cz-fab-btn { width: ${CONFIG.fabSize}; height: ${CONFIG.fabSize}; border-radius: 50%; background-color: #141517; border: 2px solid ${CONFIG.activeColor}; color: ${CONFIG.activeColor}; display: flex; align-items: center; justify-content: center; cursor: grab; box-shadow: 0 4px 15px rgba(0,0,0,0.6); position: relative; z-index: 11; transition: transform 0.1s; }
        .cz-fab-btn:active { transform: scale(0.95); cursor: grabbing; }
        .cz-fab-btn svg { width: 26px; height: 26px; fill: ${CONFIG.activeColor} !important; stroke: ${CONFIG.activeColor} !important; }

        .cz-list-panel {
            position: absolute; width: ${CONFIG.listWidth}; max-height: ${CONFIG.maxListHeight}px;
            background-color: #191b1e; border: 1px solid #333; border-radius: 12px;
            display: none; flex-direction: column; overflow: hidden;
            box-shadow: 0 8px 30px rgba(0,0,0,0.8); cursor: default; z-index: 10; color: #eee;
        }
        .cz-list-panel.show { display: flex; }

        /* [위치 자동 보정 클래스] */
        .cz-pos-top-left { bottom: 60px; right: 0; }
        .cz-pos-bottom-left { top: 60px; right: 0; }
        .cz-pos-top-right { bottom: 60px; left: 0; }
        .cz-pos-bottom-right { top: 60px; left: 0; }

        .cz-list-header { flex-shrink: 0; padding: 12px 15px; background: #232529; font-size: 13px; font-weight: bold; color: #ddd; border-bottom: 1px solid #333; display: flex; align-items: center; justify-content: space-between; }

        .cz-tab-container { display: flex; width: 100%; border-bottom: 1px solid #333; background: #191b1e; flex-shrink: 0; }
        .cz-tab-btn { flex: 1; padding: 10px 0; text-align: center; font-size: 13px; color: #888; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .cz-tab-btn:hover { background-color: rgba(255,255,255,0.05); }
        .cz-tab-btn.active { color: ${CONFIG.activeColor}; border-bottom-color: ${CONFIG.activeColor}; font-weight: bold; }

        /* [라이트 모드 - 탭 및 헤더 색상 강제 적용] */
        body.cz-light-mode .cz-list-panel { background-color: #ffffff !important; border: 1px solid #E1E1E5 !important; color: #222 !important; }
        body.cz-light-mode .cz-list-header { background-color: #f8f9fa !important; color: #222 !important; border-bottom: 1px solid #e0e0e0 !important; }
        body.cz-light-mode .cz-tab-container { background-color: #ffffff !important; border-bottom: 1px solid #e0e0e0 !important; }
        body.cz-light-mode .cz-tab-btn { color: #888 !important; }
        body.cz-light-mode .cz-tab-btn:hover { background-color: #f5f6f8 !important; }
        body.cz-light-mode .cz-tab-btn.active { color: #222 !important; border-bottom-color: ${CONFIG.activeColor} !important; }
        body.cz-light-mode .cz-list-item { border-bottom: 1px solid #f0f0f0 !important; color: #222 !important; }
        body.cz-light-mode .cz-list-item:hover { background-color: #f5f6f8 !important; }
        body.cz-light-mode .cz-video-title { color: #1E1E23 !important; }
        body.cz-light-mode .cz-video-meta { color: #767678 !important; }
        body.cz-light-mode .cz-header-btn { border-color: #ccc; color: #666; }
        body.cz-light-mode .cz-header-btn:hover { border-color: ${CONFIG.activeColor}; color: #000; }
        body.cz-light-mode .cz-header-btn.active { background-color: rgba(255, 215, 0, 0.2); color: #000; }
        body.cz-light-mode .cz-fab-btn { background-color: #ffffff !important; box-shadow: 0 4px 15px rgba(0,0,0,0.15) !important; }
        body.cz-light-mode .cz-delete-btn { background: #E1E1E5 !important; }
        body.cz-light-mode #cz-list-content::-webkit-scrollbar-thumb { background: #ccc !important; }

        /* [리스트 아이템] */
        .cz-list-item { display: flex; padding: 12px; border-bottom: 1px solid #2a2c30; position: relative; cursor: pointer; height: 94px; box-sizing: border-box; }
        .cz-list-item:hover { background-color: #232529; }

        /* [썸네일 크기 강제 고정 - 중요!] */
        .cz-thumb-box {
            width: 120px !important;
            height: 68px !important;
            margin-right: 12px;
            border-radius: 6px;
            overflow: hidden;
            background: #000;
            position: relative;
            flex-shrink: 0;
            flex-grow: 0;
        }
        .cz-thumb-img {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            display: block;
        }

        .cz-info-box { flex: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden; min-width: 0; }
        .cz-video-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: #fff; }
        .cz-video-meta { font-size: 11px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        #cz-list-content { flex: 1; overflow-y: auto; }
        #cz-list-content::-webkit-scrollbar { width: 8px; }
        #cz-list-content::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }

        .cz-clip-badge { position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.7); color: #fff; font-size: 10px; padding: 2px 4px; border-radius: 3px; font-weight: bold; }
        .cz-delete-btn { position: absolute; top: 6px; right: 6px; width: 20px; height: 20px; background: rgba(0,0,0,0.6); color: #ff5555; border-radius: 4px; display: none; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; }
        .cz-list-item:hover .cz-delete-btn { display: flex; }
        .cz-delete-btn:hover { background: #ff5555 !important; color: white !important; }
        .cz-empty-msg { padding: 30px; text-align: center; color: #777; font-size: 13px; }
        .cz-loading-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; flex-direction: column; color: #ccc; font-size: 11px; z-index: 5; }
        .cz-loading-spinner { width: 20px; height: 20px; border: 2px solid #555; border-top-color: ${CONFIG.activeColor}; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 5px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .cz-error-overlay { position: absolute; inset: 0; background: rgba(40,0,0,0.8); display: flex; align-items: center; justify-content: center; flex-direction: column; color: #ff8888; font-size: 11px; padding: 0 10px; }
        .cz-retry-btn { margin-top: 5px; background: none; border: 1px solid #ff8888; color: #ff8888; border-radius: 4px; cursor: pointer; font-size: 11px; }
        iframe[id^="cz-"] { position: fixed; top: -9999px; left: -9999px; width: 1024px; height: 768px; visibility: hidden; }
    `;
    GM_addStyle(css);

    // =========================================================================
    // 3. 헬퍼 함수
    // =========================================================================
    const delay = ms => new Promise(res => setTimeout(res, ms));

    function isValidThumbnail(url) {
        if (!url || typeof url !== 'string') return false;
        return !CONFIG.invalidThumbKeywords.some(keyword => url.includes(keyword));
    }

    // [이 함수가 없으면 에러가 발생합니다]
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

    // [디버그 헬퍼]
    const DEBUG_PREFIX = '[CHZZK-DEBUG-V11.2]';
    function debugLog(msg, ...args) {
        console.log(`%c${DEBUG_PREFIX} ${msg}`, 'background: #000; color: #00ff00; font-weight: bold; padding: 2px 4px;', ...args);
    }
    function debugErr(msg, ...args) {
        console.log(`%c${DEBUG_PREFIX} [ERROR] ${msg}`, 'background: #000; color: #ff0000; font-weight: bold;', ...args);
    }

    // [추가] API 날짜 포맷 변환 함수
    function formatApiDate(dateStr) {
        if (!dateStr) return null;
        return dateStr.split(' ')[0].replace(/-/g, '. ') + '.';
    }

    // =========================================================================
    // 4. DataMiner (VOD: DOM / Clip: API + Iframe Hybrid) - 재생 수 파싱 로직 강화
    // =========================================================================
    const DataMiner = {

        startJob: async (contentId, type) => {
            debugLog(`▶ 작업 시작. ID: ${contentId}, Type: ${type}`);
            if (type === 'clip') {
                await DataMiner.fetchClipAPI(contentId);
            } else {
                DataMiner.startVodThumbnailScan(contentId);
            }
        },

        fetchClipAPI: async (clipId) => {
            try {
                const apiUrl = `https://api.chzzk.naver.com/service/v1/clips/${clipId}/detail?optionalProperties=COMMENT&optionalProperties=PRIVATE_USER_BLOCK&optionalProperties=PENALTY&optionalProperties=MAKER_CHANNEL&optionalProperties=OWNER_CHANNEL`;
                const res = await fetch(apiUrl);
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const json = await res.json();

                if (json.code === 200 && json.content) {
                    const c = json.content;
                    const owner = c.optionalProperty ? c.optionalProperty.ownerChannel : {};

                    // API 데이터로 1차 저장 (백업용)
                    let viewCount = null;
                    if (c.readCount !== undefined && c.readCount !== null) {
                        if (c.readCount >= 10000) {
                            const man = (c.readCount / 10000).toFixed(1);
                            viewCount = `조회수 ${man}만회`;
                        } else {
                            viewCount = `조회수 ${c.readCount}회`;
                        }
                    }

                    const data = {
                        title: c.clipTitle || '제목 없음',
                        channel: owner.channelName || '알 수 없음',
                        views: viewCount,
                        date: formatApiDate(c.createdDate),
                        url: `https://chzzk.naver.com/clips/${clipId}`
                    };

                    Storage.updateData(clipId, data);

                    if (owner.channelId) {
                        DataMiner.scanClipListIframe(owner.channelId, clipId);
                    }
                }
            } catch (e) {
                Storage.setError(clipId);
            }
        },

        // [핵심 수정] "재생 수" 텍스트 파싱 로직 추가
        scanClipListIframe: async (channelId, clipId) => {
            const iframeRequest = (url, label) => {
                return new Promise((resolve) => {
                    const iframe = document.createElement('iframe');
                    iframe.id = 'cz-clip-' + Math.random().toString(36).substr(2,9);
                    iframe.src = url;
                    iframe.style.display = 'none';
                    document.body.appendChild(iframe);

                    iframe.onload = async () => {
                        await delay(2000);
                        try {
                            const doc = iframe.contentDocument || iframe.contentWindow.document;
                            const targetLink = doc.querySelector(`a[href*="/clips/${clipId}"]`);

                            if (targetLink) {
                                let thumb = null;
                                let views = null;

                                // 1. 썸네일
                                const divBg = targetLink.querySelector('div[class*="clip_card_container"]');
                                if (divBg) {
                                    const match = divBg.getAttribute('style').match(/url\((?:&quot;|"|')?(.*?)(?:&quot;|"|')?\)/);
                                    if (match) thumb = match[1];
                                }
                                if (!thumb) {
                                    const img = targetLink.querySelector('img');
                                    if (img) thumb = img.src;
                                }

                                // 2. [수정됨] 조회수 ("재생 수 5.9만" 파싱)
                                // clip_card_information 클래스를 가진 span을 우선 탐색
                                const infoSpans = targetLink.querySelectorAll('span[class*="clip_card_information"], span[class*="count"], span');

                                for (let el of infoSpans) {
                                    const text = el.innerText.trim(); // "재생 수5.9만" 처럼 읽힐 수 있음
                                    if (!text) continue;

                                    // Case A: "재생 수" 또는 "조회수"가 포함된 경우
                                    if (text.includes('재생 수') || text.includes('조회수')) {
                                        // "재생 수" 뒤에 있는 숫자+단위 추출 (예: 5.9만)
                                        const match = text.match(/([0-9,.]+[만억천]?)/);
                                        if (match) {
                                            views = `조회수 ${match[1]}회`; // "조회수 5.9만회"로 통일
                                            break;
                                        }
                                    }
                                    // Case B: 그냥 "5.9만" 처럼 숫자+단위로 끝나는 경우
                                    else if (/^[0-9,.]+[만억천]$/.test(text)) {
                                        views = `조회수 ${text}회`;
                                        break;
                                    }
                                }

                                if (thumb) {
                                    iframe.remove();
                                    resolve({ thumbnail: thumb, views: views });
                                    return;
                                }
                            }
                        } catch(e) {}
                        iframe.remove(); resolve(null);
                    };
                    setTimeout(() => { if(document.body.contains(iframe)) iframe.remove(); resolve(null); }, 10000);
                });
            };

            const u1 = `https://chzzk.naver.com/${channelId}/clips?filterType=ALL&orderType=POPULAR`;
            const u2 = `https://chzzk.naver.com/${channelId}/clips?filterType=ALL&orderType=RECENT`;

            const [res1, res2] = await Promise.all([ iframeRequest(u1, 'POPULAR'), iframeRequest(u2, 'RECENT') ]);
            const found = res1 || res2;

            if (found) {
                const updateObj = { thumbnail: found.thumbnail };
                if (found.views) updateObj.views = found.views;

                debugLog('🎉 [Clip] Iframe 정보 획득:', updateObj);
                Storage.updateData(clipId, updateObj);
            }
        },

        startVodThumbnailScan: async (contentId) => {
            let attempts = 0;
            const interval = setInterval(() => {
                const infoLink = document.querySelector('a[class*="video_information_link"]');
                if (infoLink) {
                    const match = infoLink.getAttribute('href').match(/\/live\/([a-f0-9]{32})/);
                    if (match && match[1]) {
                        clearInterval(interval);
                        DataMiner.scanVodListForThumb(match[1], contentId);
                    }
                } else {
                    attempts++;
                    if (attempts >= 10) clearInterval(interval);
                }
            }, 1000);
        },

        scanVodListForThumb: async (channelId, videoId) => {
            const iframeRequest = (url) => {
                return new Promise((resolve) => {
                    const iframe = document.createElement('iframe');
                    iframe.id = 'cz-thumb-' + Math.random().toString(36).substr(2,9);
                    iframe.src = url;
                    iframe.style.display = 'none';
                    document.body.appendChild(iframe);
                    iframe.onload = async () => {
                        await delay(2000);
                        try {
                            const doc = iframe.contentDocument || iframe.contentWindow.document;
                            const targetLink = doc.querySelector(`a[href*="/video/${videoId}"]`);
                            if (targetLink) {
                                const img = targetLink.querySelector('img[class*="video_card_image"]');
                                if (img && img.src) { iframe.remove(); resolve(img.src); return; }
                            }
                        } catch(e) {}
                        iframe.remove(); resolve(null);
                    };
                    setTimeout(() => { if(document.body.contains(iframe)) iframe.remove(); resolve(null); }, 10000);
                });
            };
            const u1 = `https://chzzk.naver.com/${channelId}/videos?sortType=LATEST&page=1`;
            const thumb = await iframeRequest(u1);
            if (thumb) Storage.updateData(videoId, { thumbnail: thumb });
        }
    };

    // =========================================================================
    // 5. 메타데이터 추출 (VOD 현재 페이지 파싱 - 조회수/날짜 정밀 구분 수정)
    // =========================================================================
    function extractVideoMetadata() {
        // VOD 페이지가 아니면 중단
        if (!window.location.pathname.startsWith('/video/')) return null;

        const videoId = window.location.pathname.split('/').pop();

        let data = {
            id: videoId,
            type: 'vod',
            title: '',
            channel: '',
            thumbnail: '', // DataMiner가 채워줌
            date: '',
            views: '조회수 정보 없음', // 기본값
            url: window.location.href,
            timestamp: Date.now()
        };

        // 1. 제목 및 채널명 (Title 태그 파싱이 가장 안정적)
        const fullTitle = document.title ? document.title.replace(' - CHZZK', '').trim() : '';
        const separatorIndex = fullTitle.indexOf(' - ');
        if (separatorIndex !== -1) {
            data.channel = fullTitle.substring(0, separatorIndex).trim();
            data.title = fullTitle.substring(separatorIndex + 3).trim();
        } else {
            data.title = fullTitle;
        }

        // 2. 조회수 및 날짜 정밀 파싱 (수정된 핵심 부분)
        // class 명에 'video_information_count'가 들어간 모든 요소(strong, span 등)를 찾음
        const infoElements = document.querySelectorAll('[class*="video_information_count"]');

        infoElements.forEach(el => {
            const text = el.innerText.trim();

            // [조건 A] 텍스트에 '조회수'가 포함되어 있으면 -> views
            if (text.includes('조회수')) {
                data.views = text;
            }
            // [조건 B] 날짜 형식(YYYY.MM.DD)이나 상대시간(전, 어제)이면 -> date
            else if (text.match(/^[0-9]{4}\.\s?[0-9]{1,2}\.\s?[0-9]{1,2}/) || text.includes('전') || text.includes('어제')) {
                data.date = convertRelativeDate(text);
            }
        });

        // 3. (백업) 날짜를 못 찾았을 경우 JSON-LD 데이터 확인
        if (!data.date) {
            try {
                const jsonLd = document.querySelector('script[type="application/ld+json"]');
                if (jsonLd) {
                    const ld = JSON.parse(jsonLd.innerText);
                    if (ld.uploadDate) {
                        const d = new Date(ld.uploadDate);
                        data.date = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
                    }
                }
            } catch(e) {}
        }

        return data;
    }

    // [수정] 클립 현재 페이지 정보 즉시 파싱 (단위 인식 개선)
    function extractClipMetadata() {
        const path = window.location.pathname;
        if (!path.startsWith('/clips/') && !path.startsWith('/embed/clip/')) return null;

        const clipId = path.split('/').pop();

        let data = {
            id: clipId,
            type: 'clip',
            title: '',
            channel: '',
            thumbnail: '',
            date: '',
            views: '조회수 정보 없음',
            url: `https://chzzk.naver.com/clips/${clipId}`, // 임베드에서도 원본 링크 저장
            timestamp: Date.now()
        };

        const fullTitle = document.title ? document.title.replace(' - CHZZK', '').trim() : '';
        if (fullTitle) {
            const separatorIndex = fullTitle.indexOf(' - ');
            if (separatorIndex !== -1) {
                data.channel = fullTitle.substring(0, separatorIndex).trim();
                data.title = fullTitle.substring(separatorIndex + 3).trim();
            } else { data.title = fullTitle; }
        }

        const infoContainer = document.querySelector('div[class*="video_information_info"]') ||
                              document.querySelector('div[class*="ClipViewer_info"]') ||
                              document.querySelector('div[class*="player_header"]');

        if (infoContainer) {
            const spans = infoContainer.querySelectorAll('span');
            spans.forEach(span => {
                const txt = span.innerText.trim();
                if (txt.includes('조회수')) {
                    data.views = txt;
                }
                // [수정] 숫자 + '만/억' + '회' 또는 그냥 숫자 + '만/억' 형식 인식
                else if (txt.match(/^[0-9.,]+[만억천]?회?$/) && !txt.includes(':') && !txt.includes('.')) {
                    // 날짜(YYYY.MM.DD)나 시간(00:00) 제외
                    data.views = `조회수 ${txt}${txt.includes('회') ? '' : '회'}`;
                }
                else if (txt.match(/^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$/) || txt.includes('전') || txt.includes('어제')) {
                    data.date = convertRelativeDate(txt);
                }
            });
        }

        return data;
    }

    // =========================================================================
    // 6. 저장소 (수정됨: GM_Storage 사용으로 Iframe/외부사이트 데이터 동기화)
    // =========================================================================
    const Storage = {
        // [핵심] localStorage -> GM_getValue로 변경
        get: () => {
            try {
                return GM_getValue(CONFIG.storageKey, []);
            } catch { return []; }
        },

        // [핵심] localStorage -> GM_setValue로 변경
        save: (list) => {
            GM_setValue(CONFIG.storageKey, list);
            UI.renderList();
        },

        add: (id, type) => {
            const list = Storage.get();
            if (list.some(item => item.id === id)) return;

            let meta = {
                id: id, type: type, status: 'loading',
                title: '정보를 불러오는 중...', channel: '잠시만요',
                thumbnail: '', date: '', views: '',
                // 저장 시엔 항상 메인 사이트 주소로 저장
                url: `https://chzzk.naver.com/${type === 'vod' ? 'video' : 'clips'}/${id}`,
                timestamp: Date.now()
            };

            if (type === 'vod') {
                const pageData = extractVideoMetadata();
                if (pageData) {
                    meta.title = pageData.title;
                    meta.channel = pageData.channel;
                    meta.date = pageData.date;
                    meta.views = pageData.views;
                }
            } else if (type === 'clip') {
                const pageData = extractClipMetadata();
                if (pageData) {
                    meta.title = pageData.title;
                    meta.channel = pageData.channel;
                    meta.date = pageData.date;
                    meta.views = pageData.views;
                }
            }

            list.push(meta);
            Storage.save(list);
            DataMiner.startJob(id, type);
        },

        updateData: (id, newData) => {
            let list = Storage.get();
            const index = list.findIndex(item => item.id === id);
            if (index !== -1) {
                if (newData.title) list[index].title = newData.title;
                if (newData.channel) list[index].channel = newData.channel;
                if (newData.thumbnail && isValidThumbnail(newData.thumbnail)) list[index].thumbnail = newData.thumbnail;
                if (newData.views) list[index].views = newData.views;
                if (newData.date) list[index].date = newData.date;

                if (list[index].title !== '정보를 불러오는 중...' && isValidThumbnail(list[index].thumbnail)) {
                    list[index].status = 'ready';
                }
                Storage.save(list);
            }
        },

        setError: (id) => {
            let list = Storage.get();
            const index = list.findIndex(item => item.id === id);
            if (index !== -1) {
                list[index].status = 'error';
                list[index].title = '정보 불러오기 실패';
                Storage.save(list);
            }
        },

        retry: (id, type) => {
            Storage.remove(id);
            Storage.add(id, type);
        },

        remove: (id) => { Storage.save(Storage.get().filter(item => item.id !== id)); },
        has: (id) => Storage.get().some(item => item.id === id)
    };

    // =========================================================================
    // 7. UI (수정됨: 탭 전환, 위치 감지, 임베드 지원)
    // =========================================================================
    const UI = {
        currentTab: 'vod',

        isClipPage: () => {
            const path = window.location.pathname;
            return path.startsWith('/clips/') || path.startsWith('/embed/clip/');
        },

        createFAB: () => {
            if (document.querySelector('.cz-fab-wrapper')) return;
            const wrapper = document.createElement('div'); wrapper.className = 'cz-fab-wrapper';
            const panel = document.createElement('div'); panel.className = 'cz-list-panel cz-pos-top-left';

            panel.innerHTML = `
                <div class="cz-list-header">
                    <span>내 즐겨찾기</span>
                    <div style="flex:1"></div>
                    <span id="cz-header-add-btn" class="cz-header-btn">+ 추가</span>
                    <span><span id="cz-count" style="color:${CONFIG.activeColor}">0</span>개</span>
                </div>
                <div class="cz-tab-container">
                    <div class="cz-tab-btn active" data-tab="vod">동영상</div>
                    <div class="cz-tab-btn" data-tab="clip">클립</div>
                </div>
                <div id="cz-list-content"></div>`;

            const fab = document.createElement('div'); fab.className = 'cz-fab-btn';
            fab.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
            wrapper.appendChild(panel); wrapper.appendChild(fab); document.body.appendChild(wrapper);

            const headerBtn = panel.querySelector('#cz-header-add-btn');
            headerBtn.onclick = (e) => {
                e.stopPropagation();
                const id = UI.getCurrentId();
                if (!id) return;

                const type = UI.isClipPage() ? 'clip' : 'vod';

                if (Storage.has(id)) {
                    if (confirm('삭제하시겠습니까?')) Storage.remove(id);
                } else {
                    UI.switchTab(type);
                    Storage.add(id, type);
                }
                UI.updateButtonState();
            };

            const tabBtns = panel.querySelectorAll('.cz-tab-btn');
            tabBtns.forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    UI.switchTab(btn.getAttribute('data-tab'));
                };
            });

            let isDragging = false, isPressed = false, shiftX = 0, shiftY = 0;
            fab.addEventListener('mousedown', (e) => {
                if(e.button!==0) return;
                isPressed=true; isDragging=false;
                const r=wrapper.getBoundingClientRect(); shiftX=e.clientX-r.left; shiftY=e.clientY-r.top;
                wrapper.style.bottom='auto'; wrapper.style.right='auto'; wrapper.style.left=`${r.left}px`; wrapper.style.top=`${r.top}px`;
                document.body.style.userSelect='none';
            });
            document.addEventListener('mousemove', (e) => {
                if(!isPressed) return;
                e.preventDefault(); wrapper.style.left=`${e.clientX-shiftX}px`; wrapper.style.top=`${e.clientY-shiftY}px`;
                isDragging=true; panel.classList.remove('show');
            });
            document.addEventListener('mouseup', () => {
                if(isPressed) {
                    isPressed=false; document.body.style.userSelect='';
                    if(isDragging) UI.updatePanelPosition();
                }
            });

            // 패널 열 때 현재 페이지에 맞춰 탭 전환
            fab.addEventListener('click', (e) => {
                e.stopPropagation();
                if(!isDragging) {
                    UI.updateButtonState();
                    if (!panel.classList.contains('show')) {
                        const targetTab = UI.isClipPage() ? 'clip' : 'vod';
                        UI.switchTab(targetTab);
                    }
                    UI.updatePanelPosition();
                    panel.classList.toggle('show');
                }
            });

            document.addEventListener('click', (e) => { if(!wrapper.contains(e.target) && !e.target.closest('.cz-bookmark-btn')) panel.classList.remove('show'); });
            window.addEventListener('resize', () => { if(panel.classList.contains('show')) UI.updatePanelPosition(); });

            UI.renderList();
        },

        switchTab: (tabName) => {
            UI.currentTab = tabName;
            const panel = document.querySelector('.cz-list-panel');
            if (!panel) return;
            const tabs = panel.querySelectorAll('.cz-tab-btn');
            tabs.forEach(t => t.classList.remove('active'));
            const activeTab = panel.querySelector(`.cz-tab-btn[data-tab="${tabName}"]`);
            if (activeTab) activeTab.classList.add('active');
            UI.renderList();
        },

        updatePanelPosition: () => {
            const wrapper = document.querySelector('.cz-fab-wrapper');
            const panel = wrapper.querySelector('.cz-list-panel');
            if (!wrapper || !panel) return;

            const fabRect = wrapper.getBoundingClientRect();
            const panelW = parseInt(CONFIG.listWidth);
            const panelH = CONFIG.maxListHeight;

            let posClass = 'cz-pos-top-left';
            wrapper.style.alignItems = 'flex-end';

            const openRight = (fabRect.left < panelW + 20);
            const openBottom = (fabRect.top < panelH + 20);

            if (openRight && openBottom) posClass = 'cz-pos-bottom-right';
            else if (openRight) posClass = 'cz-pos-top-right';
            else if (openBottom) posClass = 'cz-pos-bottom-left';

            panel.classList.remove('cz-pos-top-left', 'cz-pos-bottom-left', 'cz-pos-top-right', 'cz-pos-bottom-right');
            panel.classList.add(posClass);

            if (openRight) wrapper.style.alignItems = 'flex-start';
            else wrapper.style.alignItems = 'flex-end';
        },

        renderList: () => {
            const content = document.getElementById('cz-list-content');
            const count = document.getElementById('cz-count');
            if (!content) return;
            const rawList = Storage.get();
            const list = rawList.filter(item => (item.type || 'vod') === UI.currentTab);
            if(count) count.innerText = list.length;
            content.innerHTML = '';
            if (list.length === 0) { content.innerHTML = '<div class="cz-empty-msg">저장된 내역이 없습니다.</div>'; return; }

            list.forEach(item => {
                const row = document.createElement('div'); row.className = 'cz-list-item';
                let thumbSrc = item.thumbnail || 'https://ssl.pstatic.net/static/nng/glive/icon/favicon.png';
                const badgeHtml = (item.type === 'clip') ? '<span class="cz-clip-badge">CLIP</span>' : '';
                const metaString = `${item.channel || ''} | ${item.date || ''} | ${item.views || ''}`;

                let overlay = '';
                if(item.status === 'loading') overlay = `<div class="cz-loading-overlay"><div class="cz-loading-spinner"></div><span>로딩중</span></div>`;
                else if(item.status === 'error') overlay = `<div class="cz-error-overlay"><button class="cz-retry-btn">↻</button></div>`;

                row.innerHTML = `
                    <div class="cz-thumb-box"><img src="${thumbSrc}" class="cz-thumb-img">${badgeHtml}${overlay}</div>
                    <div class="cz-info-box"><div class="cz-video-title" title="${item.title}">${item.title}</div><div class="cz-video-meta">${metaString}</div></div>
                    <div class="cz-delete-btn" title="삭제">✕</div>
                `;

                if(item.status !== 'error') row.onclick = (e) => { if(!e.target.classList.contains('cz-delete-btn')) window.open(item.url, '_blank'); };
                const retry = row.querySelector('.cz-retry-btn');
                if(retry) retry.onclick = (e) => { e.stopPropagation(); Storage.retry(item.id, item.type); };
                row.querySelector('.cz-delete-btn').onclick = (e) => { e.stopPropagation(); if(confirm('삭제하시겠습니까?')) { Storage.remove(item.id); UI.updateButtonState(); } };
                content.appendChild(row);
            });
        },

        injectBookmarkButton: () => {
            const path = window.location.pathname;
            const isClip = path.startsWith('/clips/') || path.startsWith('/embed/clip/');
            const isVod = path.startsWith('/video/');

            const headerBtn = document.getElementById('cz-header-add-btn');
            if (headerBtn) {
                if (!isVod && !isClip) headerBtn.style.display = 'none';
                else UI.updateButtonState();
            }

            // 클립 버튼 강제 삭제
            document.querySelectorAll('.cz-bookmark-btn.cz-clip-type').forEach(btn => btn.remove());

            if (!isVod && !isClip) return;
            if (isClip) return;

            // VOD 화면 내 버튼
            if (document.querySelector('.cz-bookmark-btn')) return;

            let targetEl = null; let container = null;
            if (isVod) {
                const buttons = Array.from(document.querySelectorAll('button'));
                targetEl = buttons.find(b => b.innerText.includes('팔로잉') || b.innerText.includes('팔로우'));
                if (targetEl) container = targetEl.parentNode;
            }

            if (!container || !targetEl) return;

            const btn = document.createElement('div');
            btn.className = `cz-bookmark-btn inactive cz-vod-type`;
            btn.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

            btn.onclick = (e) => {
                e.stopPropagation(); e.preventDefault();
                const id = UI.getCurrentId();
                if (!id) return;
                if (Storage.has(id)) Storage.remove(id);
                else Storage.add(id, 'vod');
                UI.updateButtonState();
            };

            try { container.insertBefore(btn, targetEl); UI.updateButtonState(); } catch(e) {}
        },

        getCurrentId: () => {
            let currentId = '';
            const path = window.location.pathname;
            if (path.startsWith('/clips/') || path.startsWith('/embed/clip/')) {
                 const shareBtn = document.querySelector('button.naver-splugin');
                 if (shareBtn && shareBtn.dataset.url) {
                      const parts = shareBtn.dataset.url.split('/clips/');
                      if (parts.length > 1) currentId = parts[1];
                 }
                 if (!currentId) currentId = path.split('/').pop();
            } else {
                currentId = path.split('/').pop();
            }
            return currentId;
        },

        updateButtonState: () => {
            const id = UI.getCurrentId();
            const exists = Storage.has(id);
            const isClip = UI.isClipPage();
            const isVod = window.location.pathname.startsWith('/video/');

            const headerBtn = document.getElementById('cz-header-add-btn');
            if (headerBtn) {
                if (isClip || isVod) {
                    if (headerBtn.style.display !== 'block') headerBtn.style.display = 'block';
                    const newText = exists ? '- 취소' : (isClip ? '+ 클립 저장' : '+ VOD 저장');
                    if (headerBtn.innerText !== newText) headerBtn.innerText = newText;
                    if (exists && !headerBtn.classList.contains('active')) headerBtn.classList.add('active');
                    else if (!exists && headerBtn.classList.contains('active')) headerBtn.classList.remove('active');
                } else {
                    if (headerBtn.style.display !== 'none') headerBtn.style.display = 'none';
                }
            }

            const vodBtn = document.querySelector('.cz-bookmark-btn');
            if (vodBtn) {
                if (exists && vodBtn.classList.contains('inactive')) {
                    vodBtn.classList.add('active'); vodBtn.classList.remove('inactive');
                }
                else if (!exists && vodBtn.classList.contains('active')) {
                    vodBtn.classList.remove('active'); vodBtn.classList.add('inactive');
                }
            }
        }
    };

    function init() {
        UI.createFAB();

        const list = Storage.get();
        let changed = false;
        list.forEach(item => {
            if (item.status === 'loading') { item.status = 'error'; changed = true; }
        });
        if (changed) Storage.save(list);

        const checkTheme = () => {
            const html = document.documentElement;
            const isDarkMode = html.classList.contains('theme_dark');
            if (isDarkMode) { document.body.classList.add('cz-dark-mode'); document.body.classList.remove('cz-light-mode'); }
            else { document.body.classList.add('cz-light-mode'); document.body.classList.remove('cz-dark-mode'); }
            const oldFab = document.querySelector('.cz-fab-wrapper'); if (oldFab) oldFab.remove(); UI.createFAB();
            const oldBtn = document.querySelector('.cz-bookmark-btn'); if (oldBtn) oldBtn.remove();
            if (window.location.pathname.startsWith('/video/') || window.location.pathname.startsWith('/clips/')) UI.injectBookmarkButton();
        };
        const themeObserver = new MutationObserver(checkTheme);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        setTimeout(checkTheme, 500);

        let lastPath = window.location.pathname;
        const tryInject = () => {
            if (window.location.pathname.startsWith('/video/') || window.location.pathname.startsWith('/clips/')) UI.injectBookmarkButton();
        };

        const observer = new MutationObserver(() => {
            const currentPath = window.location.pathname;
            if (currentPath !== lastPath) {
                lastPath = currentPath;
                const oldBtn = document.querySelector('.cz-bookmark-btn');
                if (oldBtn) oldBtn.remove();
                tryInject();
            } else { tryInject(); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        tryInject();
        setTimeout(tryInject, 1000);

        let lastCheckId = '';
        setInterval(() => {
            if (window.location.pathname.startsWith('/clips/')) {
                const currentId = UI.getCurrentId();
                if (currentId && currentId !== lastCheckId) {
                    lastCheckId = currentId;
                    UI.updateButtonState();
                    if (!document.querySelector('.cz-bookmark-btn')) UI.injectBookmarkButton();
                }
            }
        }, 500);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();