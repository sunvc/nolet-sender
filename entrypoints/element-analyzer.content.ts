export default defineContentScript({
    matches: ['http://*/*', 'https://*/*'],
    main() {
        // 获取 i18n 
        type I18nMessageKey = Parameters<typeof browser.i18n.getMessage>[0];
        function getMessage(key: I18nMessageKey, substitutions?: string | string[]): string {
            try {
                const message = browser.i18n.getMessage(key, substitutions);
                if (message) {
                    return message;
                }
                // 如果没有找到消息, 返回 key 作 fallback
                console.warn(`未找到i18n消息: ${key}`);
                return key;
            } catch (error) {
                console.error(`获取i18n消息失败: ${key}`, error);
                return key;
            }
        }

        // console.debug('调试用 content script 已加载'); // 开发模式 macOS 的 Chrome 低版本注入不了, 实测 123 版本注入不了, 125版本注入成功

        // 存储右键点击的坐标和元素
        let rightClickX = 0;
        let rightClickY = 0;
        let rightClickElements: HTMLElement[] = [];
        // 是否已经打开
        let isDialogOpen = false;

        // 监听右键菜单事件监听器，只记录坐标和元素
        document.addEventListener('contextmenu', function (event) {
            // 记录点击位置的坐标 和 元素
            rightClickX = event.clientX;
            rightClickY = event.clientY;
            rightClickElements = getElementsFromPoint(rightClickX, rightClickY);
            // console.debug('rightClickElements', rightClickX, rightClickY, rightClickElements);
        });

        // 监听来自 background 的消息
        browser.runtime.onMessage.addListener((message) => {
            if (message.action === 'show_dialog') {
                try {
                    if (isDialogOpen) {
                        return Promise.resolve({ success: false, error: '对话框已打开' });
                    }
                    isDialogOpen = true;
                    // 当用户点击右键菜单项时显示对话框
                    showSelectionDialog(message.contextInfo);
                    return Promise.resolve({ success: true });
                } catch (error: unknown) {
                    console.error('显示对话框时出错:', error);
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    return Promise.resolve({ success: false, error: errorMessage });
                }
            }
            return Promise.resolve({ success: false, error: 'Unknown action' });
        });

        // 显示选择内容对话框
        function showSelectionDialog(contextInfo?: any) {
            const i18n = {
                link: getMessage('link_address'),  // 链接
                unknownError: getMessage('error_unknown'),  // 未知错误
                parseHtmlError: getMessage('parse_html_error'),  // 解析 HTML 时出错
                selectContentToSend: getMessage('select_content_to_send'),  // 选择要发送的内容
                close: getMessage('close'),  // 关闭
                targetInfo: getMessage('target_info'),  // 目标信息
                linkAddress: getMessage('link_address'),  // 链接地址
                sendLink: getMessage('send_link'),  // 发送链接
                selectedText: getMessage('selected_text'),  // 选中文本
                sendSelectedText: getMessage('send_selected_text'),  // 发送选中文本
                imageContent: getMessage('image_content'),  // 图片内容
                imageLink: getMessage('image_link'),  // 图片链接
                sendImageLink: getMessage('send_image_link'),  // 发送图片链接
                imageLinkInvalid: getMessage('image_link_invalid'),  // 只能发送 http 或 https 协议的图片链接
                altText: getMessage('alt_text'),  // 替代文本
                sendAltText: getMessage('send_alt_text'),  // 发送替代文本
                image: getMessage('image'),  // 图片
                imageSource: getMessage('image_source'),  // 图片来源
                reloadPreview: getMessage('reload_preview'),  // 重新加载预览
                textContent: getMessage('text_content'),  // 文字内容
                tag: getMessage('tag'),  // 标签
                backgroundImage: getMessage('background_image'),  // 背景图片
                currentElement: getMessage('current_element'),  // 当前元素
                parentElement: getMessage('parent_element'),  // 父元素
                currentElementText: getMessage('current_element_text'),  // 当前元素文本
                noParentElement: getMessage('no_parent_element'),  // 无父元素
                sendCurrentElementText: getMessage('send_current_element_text'),  // 发送当前元素文本
                parentElementText: getMessage('parent_element_text'),  // 父元素文本
                sendParentElementText: getMessage('send_parent_element_text'),  // 发送父元素文本
                pageLink: getMessage('page_link'),  // 页面链接
                pageTitle: getMessage('page_title'),  // 页面标题
                sendPageLink: getMessage('send_page_link')  // 发送页面链接
            };
            try {
                // 发送
                const handleSendContent = async (contentType: string, content: string, title: string) => {
                    if (!content.trim()) {
                        return;
                    }

                    // console.debug(`发送${contentType}:`, content);

                    const dialogContainer = getElement('.dialog-container');
                    if (dialogContainer) {
                        dialogContainer.classList.add('fetching');
                    }

                    try {
                        // 设置超时
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('请求超时')), 10000)
                        );

                        const response = await Promise.race([
                            browser.runtime.sendMessage({
                                action: 'send_content',
                                contentType,
                                content,
                                title
                            }),
                            timeoutPromise
                        ]);

                        if (dialogContainer) {
                            dialogContainer.classList.remove('fetching');
                        }

                        // 检查响应是否成功
                        if (response?.success && response?.data?.code === 200) {
                            closeDialog();
                        } else {
                            console.error('发送失败:', response);
                            alert(JSON.stringify(response));
                        }
                    } catch (error) {
                        if (dialogContainer) {
                            dialogContainer.classList.remove('fetching');
                        }
                        console.error('发送请求出错:', error);
                    }
                };

                // 查找图片元素
                // 1. 从右键点击的元素中查找
                let imgElement = rightClickElements.find(element => element.tagName.toLowerCase() === 'img') as HTMLImageElement | undefined;

                // 2. 如果没有找到，使用 querySelectorAll 查找坐标下的所有图片
                if (!imgElement) {
                    imgElement = findImagesAtPoint(rightClickX, rightClickY)[0];
                }

                // 如果没有找到img元素，尝试查找带有背景图片的元素
                let backgroundImageUrl: string | undefined;

                if (!imgElement) {
                    // 遍历所有元素，查找带有背景图片的元素
                    for (const element of rightClickElements) {
                        try {
                            // 获取计算样式
                            const computedStyle = window.getComputedStyle(element);

                            // 先检查 background-image 属性
                            let backgroundImage = computedStyle.backgroundImage;

                            // 如果 background-image 没有图片，检查 background 属性
                            if (!backgroundImage || backgroundImage === 'none') {
                                backgroundImage = computedStyle.background;
                            }

                            // 检查是否有背景图片
                            if (backgroundImage && backgroundImage !== 'none') {
                                // 使用正则匹配 url("..."), url('...'), url(...) 格式
                                const urlMatch = backgroundImage.match(/url\(['"]?(.*?)['"]?\)/i);
                                if (urlMatch && urlMatch[1]) {
                                    backgroundImageUrl = urlMatch[1];

                                    // 处理相对路径
                                    if (backgroundImageUrl.startsWith('/')) {
                                        // 转换为绝对路径
                                        const origin = window.location.origin;
                                        backgroundImageUrl = `${origin}${backgroundImageUrl}`;
                                    }

                                    // console.debug('找到背景图片元素:', {
                                    //     tagName: element.tagName,
                                    //     className: element.className,
                                    //     backgroundImage,
                                    //     extractedUrl: backgroundImageUrl
                                    // });
                                    break;
                                }
                            }

                            // 如果还没找到，检查 style 属性
                            if (!backgroundImageUrl) {
                                const inlineStyle = element.getAttribute('style');
                                if (inlineStyle) {
                                    // 查找内联样式中的背景图片
                                    const bgImageMatch = inlineStyle.match(/background(-image)?:\s*url\(['"]?(.*?)['"]?\)/i);
                                    if (bgImageMatch && bgImageMatch[2]) {
                                        backgroundImageUrl = bgImageMatch[2];

                                        // 处理相对路径
                                        if (backgroundImageUrl.startsWith('/')) {
                                            // 转换为绝对路径
                                            const origin = window.location.origin;
                                            backgroundImageUrl = `${origin}${backgroundImageUrl}`;
                                        }

                                        // console.debug('从内联样式找到背景图片:', {
                                        //     tagName: element.tagName,
                                        //     className: element.className,
                                        //     style: inlineStyle,
                                        //     extractedUrl: backgroundImageUrl
                                        // });
                                        break;
                                    }
                                }
                            }
                        } catch (e) {
                            // 忽略单个元素的处理错误，继续检查下一个
                            console.warn('处理元素背景图片时出错:', e);
                        }
                    }
                }

                // 获取点击的元素
                const clickedElement = rightClickElements.length > 0 ? rightClickElements[0] : null;

                // 获取页面URL
                const pageUrl = window.location.href;

                // 创建 Shadow DOM 宿主元素
                const shadowHost = document.createElement('div');

                // 创建closed模式的 Shadow DOM 
                const shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

                // 将宿主元素添加到 document.documentElement
                document.documentElement.appendChild(shadowHost);

                // 准备图片选项内容
                let imageContent = '';
                if (imgElement || backgroundImageUrl) {
                    const srcset = imgElement?.getAttribute('srcset');
                    // console.log('srcset', srcset);

                    // 获取最高画质的图片 URL
                    let bestQualityUrl: string | undefined;

                    if (srcset && srcset.trim()) {
                        try {
                            // 解析 srcset 为对象数组
                            const sources = srcset.split(',')
                                .filter(item => item && item.trim()) // 先过滤掉空项
                                .map(item => {
                                    const parts = item.trim().split(/\s+/);
                                    const url = parts[0] || '';
                                    const descriptor = parts[1] || '';

                                    let weight = 0;

                                    if (descriptor) {
                                        if (descriptor.endsWith('w')) {
                                            // 宽度描述符，如 "1200w"，权重为 1200
                                            const parsedWidth = parseInt(descriptor);
                                            weight = isNaN(parsedWidth) ? 0 : parsedWidth;
                                        } else if (descriptor.endsWith('x')) {
                                            // Retina 屏幕，2x 权重为 2000
                                            const parsedDensity = parseFloat(descriptor);
                                            weight = isNaN(parsedDensity) ? 0 : parsedDensity * 1000; // 乘以1000使像素密度有较高优先级
                                        }
                                    }

                                    return { url, weight };
                                })
                                .filter(source => source.url); // 过滤掉解析后可能出现的空URL

                            // 找出权重最大的图片
                            if (sources.length > 0) {
                                // 如果所有图片都没有权重，直接使用第一个
                                const allZeroWeights = sources.every(source => source.weight === 0);
                                if (allZeroWeights) {
                                    bestQualityUrl = sources[0].url;
                                } else {
                                    // 否则找出权重最大的
                                    const maxSource = sources.reduce((a, b) => (b.weight > a.weight ? b : a), sources[0]);
                                    bestQualityUrl = maxSource?.url || sources[0]?.url;
                                }
                            }
                        } catch (error) {
                            console.warn('解析srcset时出错:', error);
                            // 出错时回退到使用第一个 URL
                            try {
                                const firstUrl = srcset.split(',')[0]?.trim().split(/\s+/)[0];
                                if (firstUrl) {
                                    bestQualityUrl = firstUrl;
                                }
                            } catch (e) {
                            }
                        }
                    }

                    const imgSrc = imgElement ? (bestQualityUrl || imgElement.currentSrc || imgElement.src) : backgroundImageUrl!;
                    const imgAlt = imgElement ? (imgElement.alt || '') : '';
                    const imgSource = imgElement ? `&lt;img&gt; ${i18n.tag || '标签'}` : `${i18n.backgroundImage || '背景图片'}`;

                    const imgSize = imgElement && imgElement.naturalWidth ?
                        `${imgElement.naturalWidth} × ${imgElement.naturalHeight}` : '';

                    imageContent = `
                        <div class="option-container">
                            <div class="section-title">${i18n.imageContent || '图片内容'}</div>
                            <div class="image-content-box">
                                
                                <div class="form-area">
                                    <div class="input-group img-input-container">
                                        <label for="img-src">${i18n.imageLink || '图片链接'}:</label>
                                        <textarea id="img-src" class="textarea" spellcheck="false" autocomplete="off">${imgSrc}</textarea>
                                        <button class="btn btn-primary send-img-src">${i18n.sendImageLink || '发送图片链接'}</button>
                                        <div class="img-message" style="visibility: hidden; color: #f44336; font-size: 0.75em; margin-top: 0.25em;">${i18n.imageLinkInvalid || '只能发送http或https开头的图片链接'}</div>
                                    </div>
                                    ${imgAlt ? `
                                    <div class="input-group">
                                        <label for="img-alt">${i18n.altText || '替代文本'}:</label>
                                        <textarea id="img-alt" class="textarea" spellcheck="false" autocomplete="off">${imgAlt}</textarea>
                                        <button class="btn btn-primary send-img-alt">${i18n.sendAltText || '发送替代文本'}</button>
                                    </div>
                                    ` : ''}
                                </div>
                                <div class="preview-area">
                                    <div class="img-preview">
                                        <div class="thumbnail-container">
                                            <img src="${imgSrc}" alt="${imgAlt || i18n.image || '图片'}" title="${i18n.imageSource || '图片来源'}: ${imgSource}" class="thumbnail">
                                            ${imgSize ? `<div class="img-size">${imgSize}</div>` : ''}
                                        </div>
                                    </div>
                                    <button class="btn btn-secondary reload-preview">${i18n.reloadPreview || '重新加载预览'}</button>
                                </div>
                            </div>
                        </div>
                    `;
                }

                // 准备文本选项内容
                let textContent = '';
                if (clickedElement && clickedElement.innerText && clickedElement.innerText.trim()) {
                    const parentElement = clickedElement.parentElement;
                    const parentText = parentElement ? parentElement.innerText : (i18n.noParentElement || '无父元素');

                    textContent = `
                        <div class="option-container">
                            <div class="section-title">${i18n.textContent || '文字内容'}</div>
                            <div class="tabs">
                                <div class="tab tab-current active">${i18n.currentElement || '当前元素'}</div>
                                <div class="tab tab-parent">${i18n.parentElement || '父元素'}</div>
                            </div>
                            <div class="tab-content">
                                <div class="tab-pane current-content active">
                                    <div class="input-group">
                                        <label for="current-text">${i18n.currentElementText || '当前元素文本'}:</label>
                                        <textarea id="current-text" class="textarea" spellcheck="false" autocomplete="off">${clickedElement.innerText}</textarea>
                                        <button class="btn btn-primary send-current-text">${i18n.sendCurrentElementText || '发送当前元素文本'}</button>
                                    </div>
                                </div>
                                <div class="tab-pane parent-content">
                                    <div class="input-group">
                                        <label for="parent-text">${i18n.parentElementText || '父元素文本'}:</label>
                                        <textarea id="parent-text" class="textarea" spellcheck="false" autocomplete="off">${parentText}</textarea>
                                        <button class="btn btn-primary send-parent-text">${i18n.sendParentElementText || '发送父元素文本'}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }

                // 准备页面链接选项内容
                const urlContent = `
                    <div class="option-container">
                        <div class="section-title">${i18n.pageLink || '页面链接'}</div>
                        <div class="input-group">
                            <label for="page-title">${i18n.pageTitle || '页面标题'}:</label>
                            <input type="text" id="page-title" class="input" value="${document.title}" spellcheck="false" autocomplete="off">
                        </div>
                        <div class="input-group">
                            <label for="page-url">${i18n.pageLink || '页面链接'}:</label>
                            <textarea id="page-url" class="textarea" spellcheck="false" autocomplete="off">${pageUrl}</textarea>
                            <button class="btn btn-primary send-page-url">${i18n.sendPageLink || '发送页面链接'}</button>
                        </div>
                    </div>
                `;

                // 准备右键菜单上下文信息内容
                let contextContent = '';
                if (contextInfo) {
                    // console.debug('contextInfo', contextInfo);
                    const hasLinkInfo = contextInfo.linkUrl;
                    const hasSelectionText = contextInfo.selectionText;

                    if (hasLinkInfo || hasSelectionText) {
                        contextContent = `
                            <div class="option-container">
                                <div class="section-title">${i18n.targetInfo || '目标信息'}</div>
                                ${hasLinkInfo ? `
                                <div class="input-group">
                                    <label for="context-link-url">${i18n.linkAddress || '链接地址'}:</label>
                                    <textarea id="context-link-url" class="textarea" spellcheck="false" autocomplete="off">${contextInfo.linkUrl || ''}</textarea>
                                    ${contextInfo.linkUrl ? `<button class="btn btn-primary send-context-link">${i18n.sendLink || '发送链接'}</button>` : ''}
                                </div>
                                ` : ''}
                                
                                ${hasSelectionText ? `
                                <div class="input-group">
                                    <label for="context-selection">${i18n.selectedText || '选中文本'}:</label>
                                    <textarea id="context-selection" class="textarea" spellcheck="false" autocomplete="off">${contextInfo.selectionText || ''}</textarea>
                                    ${contextInfo.selectionText ? `<button class="btn btn-primary send-context-selection">${i18n.sendSelectedText || '发送选中文本'}</button>` : ''}
                                </div>
                                ` : ''}
                            </div>
                        `;
                    }
                }

                // 构建完整 HTML  对话框
                const dialogHTML = `
                    <div class="bark-sender-root">
                        <div class="dialog-container">
                            <div class="dialog">
                                <div class="dialog-title-container">
                                    <h2 class="dialog-title">${i18n.selectContentToSend}</h2>
                                    <button class="close-btn" title="${i18n.close}">
                                        <svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
                                    </button>
                                </div>
                                <div class="dialog-body">
                                    ${contextContent}
                                    ${imageContent}
                                    ${textContent}
                                    ${urlContent}
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const styles = `/* css start */
:host {
    font-size: 14px;
    --primary: #1976d2;
    --primary-dark: #1976d2;
    --primary-darker: #1976d2;
    --primary-light: rgba(33, 150, 243, 0.08);
    --primary-text: #ffffff;

    --secondary: #f50057;
    --secondary-dark: #c51162;
    --secondary-darker: #880e4f;
    --secondary-light: rgba(245, 0, 87, 0.08);
    --secondary-text: #ffffff;

    --surface: #ffffff;
    --background: #fafafa;
    --text-primary: rgba(0, 0, 0, 0.87);
    --text-secondary: rgba(0, 0, 0, 0.6);
    --border: #e0e0e0;
    --border-dark: #bdbdbd;
    --error: #d32f2f;
}
  
* {
    box-sizing: border-box;
    font-family: 'Roboto', Arial, Helvetica, sans-serif;
    margin: 0;
    padding: 0;
    scrollbar-width: thin;
    scrollbar-color: #c1c1c1 #f1f1f1;
}
  
.bark-sender-root {
    all: initial;
    font-family: inherit;
    font-size: 1em;
    line-height: 1.5;
    color: inherit;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    contain: layout style;
}
  
.dialog-container {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(33, 33, 33, 0.5);
    opacity: 1;
    transition: opacity 312ms ease;
}

.dialog-container.closing {
    opacity: 0;
}
  
.dialog {
    background-color: var(--surface, #fff);
    border-radius: 0.75em;
    border: 1px solid rgba(0, 0, 0, 0.36);
    box-shadow: 0px 11px 15px -7px rgba(0,0,0,0.2), 0px 24px 38px 3px rgba(0,0,0,0.14), 0px 9px 46px 8px rgba(0,0,0,0.12);
    width: 90%;
    max-width: 32em;
    max-height: 90vh;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
  
.dialog-title-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1em 1.5em;
    border-bottom: 1px solid var(--border, #e0e0e0);
    min-height: 3.5em;
    flex-shrink: 0;
    user-select: none;
    background-color: var(--primary, #1976d2);
}
  
.dialog-body {
    padding: 1em;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1em;
    background-color: var(--background, #fafafa);
    max-height: calc(90vh - 3.5em - 2em); /* 90vh - title-height - padding */
    scrollbar-width: thin;
    scrollbar-color: #c1c1c1 #f1f1f1;
}

.dialog-body::-webkit-scrollbar {
    width: 8px;
}

.dialog-body::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
}

.dialog-body::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
}

.dialog-body::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
}
  
.close-btn {
    position: relative;
    border: none;
    background: none;
    font-size: 1em;
    cursor: pointer;
    color: var(--primary-text, #ffffff);
    width: 1.5em;
    height: 1.5em;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
    margin-left: 0.5em;
}
.close-btn:hover {
    background-color: var(--primary-dark, #1565c0);
    opacity: 0.8;
    scale: 1.1;
}
.close-btn:active {
    transition: opacity 0.2s;
    opacity: 0.6;
}
  
.close-btn svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
}
  
.dialog-title {
    font-size: 1.25em;
    font-weight: 400;
    margin: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--primary-text, #ffffff);
}
  
.options-container {
    display: flex;
    flex-direction: column;
    gap: 1em;
}
  
.option-container {
    border: 1px solid var(--border, #e0e0e0);
    border-radius: 0.875em;
    padding: 1.25em;
    background-color: var(--surface, #ffffff);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
  
.section-title {
    font-weight: 600;
    font-size: 1em;
    margin-bottom: 0.5em;
    color: var(--text-primary, #424242);
    user-select: none;
}
  
.empty-message {
    padding: 1em;
    color: var(--text-secondary, #9e9e9e);
    text-align: center;
    font-style: italic;
}
  
.image-content-box {
    display: flex;
    flex-direction: row;
    gap: 1em;
}
  
.preview-area {
    margin-bottom: 1em;
}
  
.img-preview {
    display: flex;
    gap: 1em;
    margin-bottom: 0.75em;
}
  
.thumbnail-container {
    flex-shrink: 0;
    width: 7.5em;
    height: 7.5em;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border, #e0e0e0);
    background-color: #f5f5f5;
    position: relative;
    overflow: hidden;
}
  
.thumbnail {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}
.img-size {
    position: absolute;
    bottom: 0.25em;
    right: 0.5em;
    font-size: 0.625em;
    color: var(--text-secondary, #616161);
    background-color: rgba(255, 255, 255, 0.8);
    padding: 0 0.25em;
    border-radius: 0.25em;
    user-select: none;
}
  
.form-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1em;
}
.img-input-container{
    position: relative;
}
.img-message{
    position: absolute;
    bottom: -1.8em;
    width: 100%;
    background-color: var(--surface, #fff);
}
.input-group {
    display: flex;
    flex-direction: column;
    gap: 0.625em;
    margin-bottom: 0.75em;
}
  
.input-group:last-child {
    margin-bottom: 0;
}

  
  label {
    font-weight: 500;
    font-size: 0.875em;
    color: var(--text-primary, #424242);
    user-select: none;
}
.input,
.textarea {
    width: 100%;
    padding: 0.5em 0.75em;
    border-radius: 0.375em;
    border: 1px solid var(--border-dark, #bdbdbd);
    font-size: 0.875em;
    background-color: var(--surface, #fff);
    color: var(--text-primary, #212121);
    font-family: monospace;
}
.textarea {
    height: 4em;
    resize: vertical;
    font-family: monospace;
}

  #img-src {
    /* img-preview - margin-bottom - img-src - gap - */
    height: calc(105px - 2.25em);
}
  #current-text,
  #parent-text {
    height: 8em;
}
  #context-selection {
    height: 3em;
}
  
.btn {
    position: relative;
    align-self: flex-start;
    padding: 0 1em;
    height: 2.25em;
    min-width: 4em;
    border-radius: 0.75em;
    cursor: pointer;
    font-size: 0.875em;
    font-weight: 400;
    line-height: 2.25em;
    text-align: center;
    overflow: hidden;
    outline: none;
    border: none;
    user-select: none;
    vertical-align: middle;
    transition: box-shadow 0.2s, background-color 0.2s;
}
  
.btn-primary {
    background-color: var(--primary, #1976d2);
    color: var(--primary-text, white);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1), 
                0 1px 3px rgba(0, 0, 0, 0.08);
}
  
.btn-primary:hover {
    background-color: var(--primary-dark, #1565c0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), 
                0 2px 5px rgba(0, 0, 0, 0.06);
}
  
.btn-primary:active {
    background-color: var(--primary-darker, #0d47a1);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12), 
                0 1px 3px rgba(0, 0, 0, 0.08);
}
  
  /* 次要按钮样式 */
.btn-secondary {
    background-color: var(--secondary-light, rgba(245, 0, 87, 0.08));
    color: var(--secondary, #f50057);
    border: 1px solid var(--secondary, #f50057);
}
  
.btn-secondary:hover {
    background-color: var(--secondary-light, rgba(245, 0, 87, 0.12));
    opacity: 0.9;
}
  
.btn-secondary:active {
    background-color: var(--secondary-light, rgba(245, 0, 87, 0.16));
    opacity: 0.7;
}
  
  /* 涟漪效果 */
.btn::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: currentColor;
    opacity: 0;
    transition: opacity 0.2s;
}
  
.btn:hover::before {
    opacity: 0.08;
}
  
.btn:focus::before {
    opacity: 0.12;
}
  
.btn:active::before {
    opacity: 0.16;
}
  
.btn::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    border-radius: 50%;
    padding: 50%;
    width: 32px;
    height: 32px;
    background-color: currentColor;
    opacity: 0;
    transform: translate(-50%, -50%) scale(1);
    transition: opacity 1s, transform 0.5s;
}
  
.btn:active::after {
    opacity: 0.16;
    transform: translate(-50%, -50%) scale(0);
    transition: transform 0s;
}
  
.fetching .btn,
.btn:disabled {
    color: rgba(0, 0, 0, 0.38);
    background-color: rgba(0, 0, 0, 0.12);
    box-shadow: none;
    cursor: default;
    pointer-events: none;
    filter: grayscale(100%);
}
.fetching .btn::after,
.fetching .btn::before,
.btn:disabled::before,
.btn:disabled::after {
    opacity: 0;
}
  
.tabs {
    display: flex;
    border-bottom: 1px solid var(--border, #e0e0e0);
    margin-bottom: 1em;
    position: relative;
}
.tabs::after {
    content: '';
    position: absolute;
    bottom: -1px;
    height: 2px;
    width: var(--tab-width, 0);
    transform: translateX(var(--tab-x, 0));
    background-color: var(--primary, #1976d2);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.tab {
    padding: 0.5em 1.25em;
    cursor: pointer;
    font-size: 0.875em;
    font-weight: 500;
    color: var(--text-secondary, rgba(0, 0, 0, 0.6));
    position: relative;
    transition: all 0.2s ease-in-out;
    text-transform: uppercase;
    letter-spacing: 0.0892857143em;
    user-select: none;
    white-space: nowrap;
    flex: 1;
    text-align: center;
}
.tab.active {
    color: var(--primary, #1976d2);
    background-color: var(--primary-light, rgba(25, 118, 210, 0.08));
  }
.tab:hover:not(.active) {
    background-color: rgba(0, 0, 0, 0.04);
    color: var(--text-primary, rgba(0, 0, 0, 0.87));
}
.tab:active:not(.active) {
    background-color: rgba(0, 0, 0, 0.08);
    color: var(--text-primary, rgba(0, 0, 0, 0.87));
}
.tab-content {
    width: 100%;
    padding-top: 0.5em;
}
.tab-pane {
    display: none;
}
.tab-pane.active {
    display: block;
}
/* css end */`;

                // 获取 Shadow DOM 中的元素
                const getElement = (selector: string) => shadowRoot.querySelector(selector);
                const getAllElements = (selector: string) => shadowRoot.querySelectorAll(selector);

                // 关闭对话框
                const closeDialog = () => {
                    // console.debug('关闭对话框');
                    isDialogOpen = false;
                    try {
                        document.removeEventListener('keydown', handleKeyDown);

                        const dialogContainer = getElement('.dialog-container');
                        if (dialogContainer) {
                            dialogContainer.classList.add('closing');

                            setTimeout(() => {
                                try {
                                    document.documentElement.removeChild(shadowHost);
                                } catch (e) {
                                    console.error('移除对话框元素时出错:', e);
                                }
                            }, 312);
                        } else {
                            document.documentElement.removeChild(shadowHost);
                        }
                    } catch (e) {
                        console.error('关闭对话框时出错:', e);
                    } finally {
                        document.removeEventListener('keydown', handleKeyDown);
                    }
                };

                // 添加 ESC 键关闭对话框功能
                const handleKeyDown = (event: KeyboardEvent) => {
                    if (event.key === 'Escape') {
                        closeDialog();
                    }
                };
                document.addEventListener('keydown', handleKeyDown);

                // 创建样式元素
                const styleElement = document.createElement('style');
                styleElement.textContent = styles;
                shadowRoot.appendChild(styleElement);

                // 创建 DOM 结构
                const createElementFromHTML = (html: string): DocumentFragment => {
                    // 使用 DOMParser 解析 HTML 字符串
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(`<template>${html}</template>`, 'text/html');
                    const template = doc.querySelector('template');

                    if (!template) {
                        throw new Error('Failed to parse HTML');
                    }

                    return template.content;
                };

                try {
                    // 解析 HTML
                    // throw new Error('test');
                    const dialogFragment = createElementFromHTML(dialogHTML);
                    shadowRoot.appendChild(dialogFragment);
                } catch (error) {
                    console.error('解析HTML时出错:', error);

                    const fallbackDialog = document.createElement('div');
                    fallbackDialog.className = 'fallback-dialog';

                    const fallbackTitle = document.createElement('h3');
                    fallbackTitle.textContent = 'Bark Sender';
                    fallbackTitle.className = 'fallback-title';

                    const fallbackMessage = document.createElement('p');
                    fallbackMessage.textContent = i18n.parseHtmlError || '解析 HTML 时出错';
                    fallbackMessage.className = 'fallback-message';

                    const fallbackButton = document.createElement('button');
                    fallbackButton.className = 'fallback-close-btn';
                    fallbackButton.title = i18n.close || '关闭';
                    const fallbackSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    fallbackSvg.setAttribute('viewBox', '0 0 24 24');
                    const fallbackPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    fallbackPath.setAttribute('d', 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
                    fallbackSvg.appendChild(fallbackPath);
                    fallbackButton.appendChild(fallbackSvg);
                    fallbackButton.onclick = closeDialog;

                    const fallbackStyle = document.createElement('style');
                    fallbackStyle.textContent = `/* css start */
.fallback-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2147483647;
}
.fallback-title {
    margin-bottom: 15px;
    font-size: 18px;
    font-weight: 600;
    min-width: 200px;
}
.fallback-message {
    margin-bottom: 15px;
}
.fallback-close-btn {
    margin-top: 15px;
    padding: 1px;
    background: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #d32f2f;
}
.fallback-close-btn svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
}
.fallback-close-btn:hover {
    background-color: rgb(253, 237, 237);
    opacity: 0.8;
}
.fallback-close-btn:active {
    opacity: 0.6;
    transition: opacity 0.2s;
}
/* css end */`;

                    fallbackDialog.appendChild(fallbackTitle);
                    fallbackDialog.appendChild(fallbackMessage);
                    fallbackDialog.appendChild(fallbackButton);

                    shadowRoot.appendChild(fallbackStyle);
                    shadowRoot.appendChild(fallbackDialog);
                }

                // 点击背景关闭
                const dialogContainer = getElement('.dialog-container');
                if (dialogContainer) {
                    dialogContainer.addEventListener('click', (e) => {
                        if (e.target === dialogContainer) {
                            closeDialog();
                        }
                    });
                }

                // 关闭按钮事件
                const closeBtn = getElement('.close-btn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', closeDialog);
                }

                // 重新加载预览按钮
                const reloadPreviewBtn = getElement('.reload-preview');
                const imgSrcTextarea = getElement('#img-src') as HTMLTextAreaElement | null;
                const thumbnailImg = getElement('.thumbnail') as HTMLImageElement | null;
                const sendImgSrcBtn = getElement('.send-img-src') as HTMLButtonElement | null;
                const imgMessage = getElement('.img-message') as HTMLDivElement | null;

                // 检查图片链接是否有效 以 http | https 开头   
                const checkImageUrl = (url: string): boolean => {
                    return url.trim().startsWith('http://') || url.trim().startsWith('https://');
                };

                // 重新加载预览按钮事件
                if (reloadPreviewBtn && imgSrcTextarea && thumbnailImg) {
                    reloadPreviewBtn.addEventListener('click', () => {
                        thumbnailImg.src = imgSrcTextarea.value.trim();
                    });
                }

                // 发送图片链接按钮
                const imgAltTextarea = getElement('#img-alt') as HTMLTextAreaElement | null;

                if (sendImgSrcBtn && imgSrcTextarea) {
                    sendImgSrcBtn.addEventListener('click', () => {
                        const imageUrl = imgSrcTextarea.value.trim();
                        // 处理各种路径情况
                        let processedUrl = imageUrl;

                        if (imageUrl.startsWith('//')) {
                            processedUrl = `${window.location.protocol}${imageUrl}`;
                        }
                        else if (imageUrl.startsWith('/')) {
                            processedUrl = `${window.location.origin}${imageUrl}`;
                        }
                        else if (imageUrl.startsWith('./')) {
                            const currentPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
                            processedUrl = `${window.location.origin}${currentPath}${imageUrl.slice(2)}`;
                        }
                        else if (imageUrl.startsWith('../')) {
                            let currentPath = window.location.pathname;
                            const segments = imageUrl.split('/');
                            let upCount = 0;

                            while (segments[upCount] === '..') {
                                upCount++;
                            }

                            const pathSegments = currentPath.split('/').filter(segment => segment.length > 0);
                            const targetPath = pathSegments.slice(0, -upCount).join('/');
                            const remainingPath = segments.slice(upCount).join('/');

                            processedUrl = `${window.location.origin}/${targetPath}/${remainingPath}`;
                        }

                        // 检查处理后的 URL 是否有效 // 可能存在 blob: 或者 base64 等
                        if (checkImageUrl(processedUrl)) {
                            // 更新文本框中的 URL 为处理后的 URL
                            imgSrcTextarea.value = processedUrl;
                            if (imgMessage) {
                                imgMessage.style.visibility = 'hidden';
                            }
                            const title = imgAltTextarea && imgAltTextarea.value ? imgAltTextarea.value.trim() || (i18n.image || '图片') : (i18n.image || '图片');
                            handleSendContent('image', processedUrl, title);
                        } else {
                            if (imgMessage) {
                                imgMessage.style.visibility = 'visible';
                            }
                            sendImgSrcBtn.disabled = true;
                            // 添加一个延时，让用户修改后重新启用按钮
                            setTimeout(() => {
                                if (sendImgSrcBtn) {
                                    sendImgSrcBtn.disabled = false;
                                    if (imgMessage) {
                                        imgMessage.style.visibility = 'hidden';
                                    }
                                }
                            }, 2000);
                        }
                    });
                }

                // 发送替代文本按钮
                const sendImgAltBtn = getElement('.send-img-alt');

                if (sendImgAltBtn && imgAltTextarea) {
                    sendImgAltBtn.addEventListener('click', () => {
                        const altText = imgAltTextarea.value.trim();
                        handleSendContent('text', altText, '图片替代文本');
                    });
                }

                // 发送当前元素文本按钮
                const sendCurrentTextBtn = getElement('.send-current-text');
                const currentTextarea = getElement('#current-text') as HTMLTextAreaElement | null;

                if (sendCurrentTextBtn && currentTextarea) {
                    sendCurrentTextBtn.addEventListener('click', () => {
                        const text = currentTextarea.value.trim();
                        handleSendContent('text', text, '当前元素文本');
                    });
                }

                // 发送父元素文本按钮
                const sendParentTextBtn = getElement('.send-parent-text');
                const parentTextarea = getElement('#parent-text') as HTMLTextAreaElement | null;

                if (sendParentTextBtn && parentTextarea) {
                    sendParentTextBtn.addEventListener('click', () => {
                        const text = parentTextarea.value.trim();
                        if (text && text !== '无父元素') {
                            handleSendContent('text', text, '父元素文本');
                        }
                    });
                }

                // 发送页面链接按钮
                const sendPageUrlBtn = getElement('.send-page-url');
                const pageTitleInput = getElement('#page-title') as HTMLInputElement | null;
                const pageUrlTextarea = getElement('#page-url') as HTMLTextAreaElement | null;

                if (sendPageUrlBtn && pageTitleInput && pageUrlTextarea) {
                    sendPageUrlBtn.addEventListener('click', () => {
                        const url = pageUrlTextarea.value.trim();
                        const title = pageTitleInput.value.trim() || '网页链接';
                        handleSendContent('url', url, title);
                    });
                }

                // 处理右键菜单上下文信息区域的按钮
                if (contextInfo) {
                    // 发送链接按钮
                    const sendContextLinkBtn = getElement('.send-context-link');
                    const contextLinkUrlTextarea = getElement('#context-link-url') as HTMLTextAreaElement | null;

                    if (sendContextLinkBtn && contextLinkUrlTextarea) {
                        sendContextLinkBtn.addEventListener('click', () => {
                            const url = contextLinkUrlTextarea.value.trim();
                            handleSendContent('url', url, (i18n.link || '链接'));
                        });
                    }

                    // 发送选中文本按钮
                    const sendContextSelectionBtn = getElement('.send-context-selection');
                    const contextSelectionTextarea = getElement('#context-selection') as HTMLTextAreaElement | null;

                    if (sendContextSelectionBtn && contextSelectionTextarea) {
                        sendContextSelectionBtn.addEventListener('click', () => {
                            const text = contextSelectionTextarea.value.trim();
                            handleSendContent('text', text, '选中文本');
                        });
                    }
                }

                // 切换选项卡
                const tabs = getAllElements('.tab');
                const tabsContainer = getElement('.tabs') as HTMLElement | null;

                if (tabsContainer) {
                    // 初始化指示器位置
                    const activeTab = getElement('.tab.active') as HTMLElement | null;
                    if (activeTab) {
                        const width = activeTab.offsetWidth;
                        const left = activeTab.offsetLeft;
                        tabsContainer.style.setProperty('--tab-width', `${width}px`);
                        tabsContainer.style.setProperty('--tab-x', `${left}px`);
                    }

                    tabs.forEach(tab => {
                        tab.addEventListener('click', () => {
                            tabs.forEach(t => t.classList.remove('active'));
                            tab.classList.add('active');

                            // 更新指示器位置
                            const width = (tab as HTMLElement).offsetWidth;
                            const left = (tab as HTMLElement).offsetLeft;
                            tabsContainer.style.setProperty('--tab-width', `${width}px`);
                            tabsContainer.style.setProperty('--tab-x', `${left}px`);

                            // 显示对应内容
                            const panes = getAllElements('.tab-pane');
                            panes.forEach(pane => pane.classList.remove('active'));

                            if (tab.classList.contains('tab-current')) {
                                const currentPane = getElement('.current-content');
                                if (currentPane) currentPane.classList.add('active');
                            } else if (tab.classList.contains('tab-parent')) {
                                const parentPane = getElement('.parent-content');
                                if (parentPane) parentPane.classList.add('active');
                            }
                        });
                    });
                }
            } catch (error) {
                console.error('显示对话框时出错:', error);
                alert(error instanceof Error ? error.message : (i18n.unknownError || '未知错误'));
                isDialogOpen = false; // 重置状态
            }
        }

        function findImagesAtPoint(x: number, y: number): HTMLImageElement[] {
            const images = document.querySelectorAll('img');

            const imagesAtPoint: HTMLImageElement[] = [];

            images.forEach(img => {
                const rect = img.getBoundingClientRect(); // 获取图片在页面上的位置和大小
                if (
                    x >= rect.left &&
                    x <= rect.right &&
                    y >= rect.top &&
                    y <= rect.bottom
                ) {
                    imagesAtPoint.push(img as HTMLImageElement);
                }
            });

            // console.debug('坐标点下的图', x, y, imagesAtPoint);
            return imagesAtPoint;
        }

        // 获取指定坐标下方的所有元素
        function getElementsFromPoint(x: number, y: number): HTMLElement[] {
            /* 使用 document.elementsFromPoint 获取所有元素
            // 这个 API 返回指定坐标处所有元素的数组，从最上层到最下层排序 */
            if (document.elementsFromPoint) {
                return Array.from(document.elementsFromPoint(x, y)) as HTMLElement[];
            }

            // 兼容性处理: 如果不支持 elementsFromPoint 则使用 elementFromPoint
            const result: HTMLElement[] = [];
            let element = document.elementFromPoint(x, y) as HTMLElement | null;

            while (element && element !== document.documentElement) {
                result.push(element);

                // 临时隐藏元素以获取下一层元素
                element.style.pointerEvents = 'none';

                // 获取下一层元素
                element = document.elementFromPoint(x, y) as HTMLElement | null;
            }

            // 恢复所有元素的 pointerEvents 
            result.forEach(el => el.style.pointerEvents = '');

            return result;
        }
    },
}); 