// 2026-11-09 文案调整：样片模型名称在 2.5 后增加一个空格，与模型目录保持一致。
/* 2026-11-09 Product Design UI 适配：
 * 仅装饰全能创作已有生成确认卡，不替换参数选项、请求、模型目录或确认/取消处理器。
 * 已确认文案读取旧流程的 approved 状态；提示词通过独立草稿提供编辑、保存和取消。
 * 菜单定位只写布局样式，按视口避让；保留所有原选择、滑杆、积分和生成行为。
 */
(() => {
  function install() {
    if (document.getElementById('character-asset-canvas-theme')) return;
    const messages = document.getElementById('messages');
    if (!messages) return;
    const logos = {
      'MiniMax H3': 'canvas-ui-reference/minimax-h3.png',
      'MiniMax H3 Fast': 'canvas-ui-reference/minimax-h3-fast.png',
      'Seedance 2.5': 'canvas-ui-reference/seedance-25.png',
      // 2026-11-09：确认卡中的免会员样片模式同样复用2.5图标。
      'Seedance 2.5 样片模式': 'canvas-ui-reference/seedance-25.png',
      'Seedance 2.0': 'canvas-ui-reference/seedance-20.png',
      'Seedance 2.0 fast': 'canvas-ui-reference/seedance-20-fast.png',
      'Seedance 2.0 mini': 'canvas-ui-reference/seedance-20-mini.png',
      'VinaAnime 1.0': 'canvas-ui-reference/vinaanime-10.png',
      'Wan 3.0': 'canvas-ui-reference/wan-30.png',
      'Kling v3 Omni': 'images/model-kling.png',
      'Seedream 5.0 lite': 'images/model-seedance.png',
      'Gpt Image 2': 'images/model-gpt.png',
      'Nano Banana 2': 'images/model-banana.png',
      'Nano Banana pro': 'images/model-banana.png',
      'Mureka v9.5': 'canvas-ui-reference/music.svg'
    };
    function logo(element, model) {
      if (!element) return;
      const asset = logos[model];
      if (!asset) {
        element.removeAttribute('data-confirm-model-logo');
        element.style.removeProperty('--confirm-model-logo');
        return;
      }
      const url = new URL('./assets/' + asset, document.baseURI).href;
      if (element.getAttribute('data-confirm-model-logo') === url) return;
      element.setAttribute('data-confirm-model-logo', url);
      element.style.setProperty('--confirm-model-logo', 'url("' + url + '")');
    }
    // 2026-11-09 Product Design / ego：编辑使用独立草稿，取消或收起不修改原提示词；只有保存才写回现有请求。
    const promptEditors = new WeakMap();
    const pencilSource = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#A6B1BD" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 20 4.2-1 10.4-10.4a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.6 7 2.8 2.8"/></svg>');
    function closePromptEditor(card, save) {
      const state = promptEditors.get(card);
      if (!state) return;
      const value = state.field.value.trim();
      if (save && !value) return;
      if (save) {
        state.prompt.textContent = value;
        // 继续复用原提示词同步入口，模型、积分与生成参数保持原流程。
        if (typeof pendingGeneration !== 'undefined' && pendingGeneration?.card === card && pendingGeneration.status === undefined) {
          syncGenerationRequestPrompt(pendingGeneration);
        }
      }
      promptEditors.delete(card);
      state.editor.remove();
      card.classList.remove('is-prompt-editing', 'expanded');
      const toggle = card.querySelector('.generation-card-expand');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', '展开提示词');
        toggle.title = '展开提示词';
      }
      if (card.isConnected && !card.classList.contains('disabled')) card.querySelector('.generation-card-edit')?.focus({ preventScroll: true });
    }
    function openPromptEditor(card) {
      if (card.classList.contains('disabled') || promptEditors.has(card)) return;
      const prompt = card.querySelector('[data-generation-prompt-edit]');
      if (!prompt) return;
      if (typeof closeGenerationParamMenus === 'function') closeGenerationParamMenus(card);
      const editor = document.createElement('section');
      editor.className = 'generation-prompt-editor';
      editor.setAttribute('aria-label', '编辑提示词');
      const field = document.createElement('textarea');
      field.className = 'generation-prompt-editor-field';
      field.setAttribute('aria-label', '提示词');
      field.maxLength = 20000;
      field.spellcheck = false;
      field.value = prompt.innerText.trim();
      const actions = document.createElement('div');
      actions.className = 'generation-prompt-editor-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'generation-prompt-editor-cancel';
      cancel.textContent = '取消';
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'generation-prompt-editor-save';
      save.textContent = '保存';
      save.disabled = !field.value.trim();
      cancel.addEventListener('click', () => closePromptEditor(card, false));
      save.addEventListener('click', () => closePromptEditor(card, true));
      field.addEventListener('input', () => { save.disabled = !field.value.trim(); });
      field.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePromptEditor(card, false); }
      });
      actions.append(cancel, save);
      editor.append(field, actions);
      promptEditors.set(card, { editor, field, prompt });
      prompt.insertAdjacentElement('afterend', editor);
      card.classList.add('is-prompt-editing', 'expanded');
      field.focus({ preventScroll: true });
    }
    // 箭头在编辑态用于取消并收起草稿；普通预览仍交给原展开事件，文字本身不触发展开。
    messages.addEventListener('click', event => {
      const toggle = event.target.closest('[data-action="toggle-generation-expand"]');
      const card = toggle?.closest('.generation-card');
      if (!card || !promptEditors.has(card)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closePromptEditor(card, false);
    }, true);
    // 2026-11-09 Product Design：模型名称右侧复用画布原绿色会员钻石；标识本身不嵌套按钮，点击由共用整行捕获入口处理。
    const membershipDiamondSource = 'data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgdmlld0JveD0iMCAwIDIzLjk5OTUgMTguMDA1NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgaWQ9Ikdyb3VwIDIiPgo8ZyBpZD0iVW5pb24iIGZpbHRlcj0idXJsKCNmaWx0ZXIwX2lfMF83OCkiPgo8cGF0aCBkPSJNMTUuODk5OSA4LjQ5MDc1QzE1LjkzNTggOC40OTcwMSAxNS45NzQ1IDguNDkxNzIgMTYuMDExMyA4LjQ5MTcyQzE2LjcxMzcgOC41MzMwNCAxNy40MTUyIDguNTcyNjggMTguMDk5MiA4Ljc3MDA0QzE4Ljc0NjQgOC45NTc0MSAxOS4xMDEyIDkuMzkwNzggMTkuMjc5OCAxMC4wMkMxOS4zNDgyIDEwLjI2MSAxOS4zMTM1IDEwLjQxMzMgMTkuMTM4MiAxMC42MDIxQzE2Ljg3ODggMTMuMDM1NyAxNC42MzA5IDE1LjQ4MDQgMTIuMzc4NSAxNy45MjA0QzEyLjM0MzIgMTcuOTU4NSAxMi4yODYyIDE3Ljk3NzggMTIuMjM5OCAxOC4wMDU0QzEyLjIzODEgMTcuOTQzNSAxMi4yMTkyIDE3Ljg3NDggMTIuMjM4OCAxNy44MjA4QzEyLjcwNjIgMTYuNTM3NiAxMy4xNzkgMTUuMjU2NCAxMy42NDkgMTMuOTc0MUMxNC4yOTAzIDEyLjIyNCAxNC45MzM1IDEwLjQ3MzUgMTUuNTY2IDguNzIwMjRDMTUuNjMwOCA4LjU0MDY0IDE1LjcxMTIgOC40NTcwOCAxNS44OTk5IDguNDkwNzVaTTYuMDU0MjQgNi41Mzk1OEM2LjM1ODg5IDYuNTM5OTkgNi40NDk0NSA2LjYxMTYzIDYuNTU1MjEgNi44OTg5NUM3LjA4OTA4IDguMzQ0NzUgNy42Mjc3NyA5Ljc4OTA5IDguMTYwNjggMTEuMjM0OUM4LjY0NTg4IDEyLjU1MTUgOS4xMjU2MyAxMy44NzA3IDkuNjA4OTIgMTUuMTg4QzkuOTI0MzQgMTYuMDQ3OCAxMC4yNDExIDE2LjkwNzMgMTAuNTU3MiAxNy43NjcxQzEwLjU3MTcgMTcuODA2NyAxMC41OTIgMTcuODQ2MSAxMC41OTcyIDE3Ljg4NzJDMTAuNjAxNiAxNy45MjMzIDEwLjU4OCAxNy45NjIyIDEwLjU4MjYgMTcuOTk5NUMxMC41NDYxIDE3Ljk4NjkgMTAuNDk4IDE3Ljk4NTQgMTAuNDc0MiAxNy45NjA1QzEwLjI5MTcgMTcuNzY4OCAxMC4xMTM3IDE3LjU3MiA5LjkzNDEyIDE3LjM3NzVDNy42OTg1MSAxNC45NTY1IDUuNDY0OSAxMi41MzM5IDMuMjI2MTEgMTAuMTE1N0MyLjIxNDY4IDkuMDIzNTUgMS4xOTE5MiA3Ljk0MTA3IDAuMTc4MjU5IDYuODUxMUMwLjEyNzM5MyA2Ljc5NjQyIDAuMTEzMDQ2IDYuNzA3NzcgMC4wODE1Nzk2IDYuNjM1MjhDMC4xNTkzNDIgNi42MDM0NiAwLjIzNzIxNSA2LjU0NTEyIDAuMzE0OTc4IDYuNTQ0NDZDMS4yNzg4NCA2LjUzODEgMi4yNDMzOCA2LjU0MDU1IDMuMjA3NTYgNi41NDA1NVY2LjUzODZIMy4yMDg1M0M0LjE1Njk2IDYuNTM4NiA1LjEwNTgxIDYuNTM4NjIgNi4wNTQyNCA2LjUzOTU4Wk03LjY5MDk1IDYuNTMzNzJDOC45MjQ5MiA2LjU0ODY2IDEwLjE1OTggNi41Mzk1OCAxMS4zOTQxIDYuNTM5NThWNi41Mzg2SDE1LjIwODVDMTUuNTEzMyA2LjUzODc3IDE1LjYxMzQgNi42NzQ2MSAxNS41MDgzIDYuOTYxNDVDMTQuODk1IDguNjM3MzggMTQuMjc3IDEwLjMxMTkgMTMuNjY1NiAxMS45ODg4QzEyLjk1MzMgMTMuOTQyNiAxMi4yNDYzIDE1Ljg5OTIgMTEuNTMzNyAxNy44NTMxQzExLjUxMzMgMTcuOTA4NiAxMS40NTA5IDE3Ljk0OTMgMTEuNDA3OCAxNy45OTY2QzExLjM2NzQgMTcuOTQ1NSAxMS4zMDk5IDE3LjkwMDQgMTEuMjg4NiAxNy44NDIzQzEwLjcyMTQgMTYuMjk3MiAxMC4xNjAyIDE0Ljc1MDEgOS41OTMzIDEzLjIwNDZDOC44NDIyNCAxMS4xNTYyIDguMDkyNzUgOS4xMDY2NSA3LjMyODY1IDcuMDYzMDFDNy4xNzE4OSA2LjY0NDIzIDcuMzAwMTYgNi41Mjg5NSA3LjY5MDk1IDYuNTMzNzJaTTE4LjYyMTYgMC41NjY5MTlDMTguNzE4NiAwLjMzMjEwMyAxOC44NTgxIDAuMzE0NjM2IDE5LjAxMjIgMC41MTgwOTFDMTkuODA1OSAxLjU2NDc5IDIwLjYwMSAyLjYxMDQ1IDIxLjM5MTEgMy42NTk2OUMyMS44NSA0LjI2ODkxIDIyLjMwNDIgNC44ODIzNSAyMi43NTM1IDUuNDk4NTZDMjIuNzk3MSA1LjU1ODU4IDIyLjgzNDYgNS42NzcxOCAyMi44MDUyIDUuNzIzMTdDMjIuNzYyNCA1Ljc4ODg3IDIyLjY1NTUgNS44NDc2NyAyMi41NzQ3IDUuODQ5MTVDMjEuODk2OSA1Ljg1OSAyMS4yODE4IDUuODUxNTggMjAuNjA0IDUuODU3OTNDMjAuNDgxIDUuODU5MTggMjAuNDcwMSA1Ljc4NDAzIDIwLjQ0ODggNS43MDE2OEwxOS45ODQ5IDMuMjI0MTVMMTkuNDQ4OCA1Ljc1MTQ5QzE5LjQzNjIgNS44MDk4NSAxOS4zODQ0IDUuODUxODQgMTkuMzI0NyA1Ljg1MjA4SDE4Ljk2MDVDMTguOTM4IDUuODUyMTEgMTcuNjYyOSA1Ljg1NDAzIDE3LjAyMiA1Ljg1NDAzQzE2Ljc2NzYgNS44NTQwMyAxNi42NzQ1IDUuNzI0MyAxNi43NjUyIDUuNDgzOTFDMTcuMzM2MiAzLjk2ODI3IDE3LjkwOTcgMi40NTMwMiAxOC40ODIgMC45MzgwMTNDMTguNTI4NiAwLjgxNDUwOCAxOC41NzE1IDAuNjg5MTQ4IDE4LjYyMTYgMC41NjY5MTlaTTQuMDE3MTMgMC4zOTIxMTRDNC4wODkwNiAwLjQwOTAzMiA0LjE2NjYzIDAuNTAzNjE2IDQuMTk2ODEgMC41ODE1NjdDNC42NzI3OSAxLjgyMTkxIDUuMTQyMjMgMy4wNjUyNCA1LjYxMTg1IDQuMzA4MTNDNS43NTU4MyA0LjY4OTIyIDUuODk5NjkgNS4wNzA5OSA2LjAzNzYzIDUuNDU0NjFDNi4xMzgwNCA1LjczMzkzIDYuMDQ5NjMgNS44NTM1NiA1Ljc1MTUgNS44NTQwM0M0Ljg0NTM2IDUuODU0NjYgMy45Mzg4OSA1Ljg1NDAzIDMuMDMyNzUgNS44NTQwM1Y1Ljg1MDEySDAuMzE0MDAxQzAuMjc2OTM5IDUuODUwMTUgMC4yMzUzNzUgNS44NjEwMSAwLjIwMzY1IDUuODQ4MTdDMC4xMzM3MTIgNS44MTk1NiAwLjAzNDE5NTMgNS43OTI4MiAwLjAxMTI2NzEgNS43Mzg3OUMtMC4wMTQ0MzU0IDUuNjc3MDkgMC4wMDY0MjIyMSA1LjU2OTA4IDAuMDQ4Mzc2NCA1LjUxMDI4QzAuMzIxNzI1IDUuMTI2MzMgMC42MDMwOTMgNC43NDc2MiAwLjg4NzI0NCA0LjM3MTYxQzEuODU4NjEgMy4wODY3NCAyLjgzMTY5IDEuODAyNzMgMy44MDgxNCAwLjUyMTk5N0MzLjg1Njg2IDAuNDU4NDM1IDMuOTU5MzIgMC4zNzkwOTEgNC4wMTcxMyAwLjM5MjExNFpNMTEuMjI4MSAwLjI0NDY1M0MxMS4zMzkgMC4wOTQxNDE3IDExLjQ4MDcgMC4wOTA4MzI1IDExLjU5MDQgMC4yNDM2NzdDMTEuODUyNCAwLjYwOTMyMiAxMi4xMTA5IDAuOTc4MDI4IDEyLjM2OTcgMS4zNDYyMkMxMy4xNzkyIDIuNDk4ODUgMTMuOTg4NSAzLjY1MTkzIDE0Ljc5NjQgNC44MDUyQzE0Ljk1NDQgNS4wMzA2MiAxNS4xMTQzIDUuMjU1NzcgMTUuMjU4MyA1LjQ4OTc3QzE1LjMwMiA1LjU2MDgzIDE1LjMzNDUgNS42ODUwNiAxNS4zMDEzIDUuNzQ0NjVDMTUuMjY2NCA1LjgwNjI3IDE1LjE0NDMgNS44NDg0MSAxNS4wNjAxIDUuODQ5MTVDMTQuMTAxNSA1Ljg1NjE0IDEzLjE0MjcgNS44NTI3MyAxMi4xODQxIDUuODUzMDVIMTEuNDA1OEMxMC4xODc4IDUuODUzMDUgOC45Njk1IDUuODU1ODIgNy43NTE1IDUuODQ5MTVDNy42NjgyMiA1Ljg0ODgzIDcuNTQ2OTYgNS44MDM2OSA3LjUxMjI0IDUuNzQxNzJDNy40Nzg3NCA1LjY4MTIyIDcuNTA3NTYgNS41NTMyMiA3LjU1NDI0IDUuNDg2ODRDOC43MjA0MyAzLjgxNTEyIDkuODkzMDQgMi4xNDcyNSAxMS4wNjQgMC40NzkwMjhDMTEuMTE4NiAwLjQwMTI4NSAxMS4xNzE2IDAuMzIxMTMyIDExLjIyODEgMC4yNDQ2NTNaTTE3LjcxMzQgMC4wMDE0ODkyOEMxNy45OTQ1IDAuMDAxOTEzNDMgMTguMDc0MiAwLjExOTA1NyAxNy45NzQyIDAuMzg1Mjc4QzE3LjM4NDEgMS45NTYyMyAxNi43OTM5IDMuNTI3NDkgMTYuMTk3OCA1LjA5NjIyQzE2LjE2OTggNS4xNjk4NSAxNi4wOTI1IDUuMjU3NTIgMTYuMDI0IDUuMjcyOTdDMTUuOTcwMyA1LjI4NDc2IDE1Ljg3MzYgNS4yMDkxOCAxNS44MzA2IDUuMTQ3OTdDMTQuNzA2OSAzLjU0ODI1IDEzLjU4NjMgMS45NDU0OSAxMi40NzAzIDAuMzQwMzU2QzEyLjQyNDggMC4yNzQ4NCAxMi4zODc2IDAuMTU3NjM0IDEyLjQxNjUgMC4wOTkxNDU1QzEyLjQ0NDQgMC4wNDMyODkyIDEyLjU2MzQgMC4wMDYwMzA3NiAxMi42NDIxIDAuMDA1Mzk1NTNDMTMuNDg5NyAtMC4wMDA5NTg5NzMgMTQuMzM4MiAwLjAwMTE3MTM3IDE1LjE4NjEgMC4wMDE0ODkyOEMxNi4wMjg0IDAuMDAxNDg4NjQgMTYuODcxMSAwLjAwMDIxNzg2IDE3LjcxMzQgMC4wMDE0ODkyOFpNMTAuMTYzNiAwLjAwNDQxODk3QzEwLjI0ODIgMC4wMDUxMzY5NCAxMC4zNzcyIDAuMDM5NzA5NiAxMC40MDQ4IDAuMDk3MTkyNEMxMC40MzM3IDAuMTU3NTY5IDEwLjM4NTQgMC4yNzg1NDcgMTAuMzM2NSAwLjM0OTE0NkM5LjI2NzYxIDEuODgzMTEgOC4xOTM5NyAzLjQxNDQgNy4xMjE2MiA0Ljk0NTgzQzcuMDczMDIgNS4wMTUwNyA3LjAzNDg1IDUuMDk0NzMgNi45NzcwOSA1LjE1NDgxQzYuOTI2IDUuMjA4MDkgNi44NDYxOSA1LjI4MTEyIDYuNzkyNTIgNS4yNzJDNi43MjY3MSA1LjI1OTkyIDYuNjQ3NjggNS4xODExNyA2LjYyMDY0IDUuMTEyODJDNi40NjY1MyA0LjcyNDQ4IDYuMzI3MzQgNC4zMzAxOSA2LjE4MDIxIDMuOTM4OTlDNS43MzczIDIuNzU5NjkgNS4yOTExNiAxLjU4MTE2IDQuODUxMTEgMC40MDA5MDNDNC43Mzk4NSAwLjEwMjA4OCA0LjgxNzM0IDAuMDAyODQwMDkgNS4xNDAxNyAwLjAwMjQ2NTg1QzUuOTcxOSAwLjAwMTUxMjUgNi44MDQyMiAwLjAwMjQ2NTg1IDcuNjM2MjcgMC4wMDI0NjU4NVYwLjAwMDUxMjcyMkM4LjQ3ODcyIDAuMDAwNTEyMTIgOS4zMjE0OCAtMC4wMDE5MzcxNiAxMC4xNjM2IDAuMDA0NDE4OTdaIiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfMF83OCkiLz4KPC9nPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNMTUuOTYzNSA3Ljk2NDkyQzE2LjM1ODEgNy45Mjk5NCAxNi43NTgyIDcuOTIyOTQgMTcuMTQ2NCA3Ljg1MjM1QzE3LjYwMjQgNy43Njk2OCAxOC4wNTcxIDcuNjU4MDcgMTguNDk2NiA3LjUxMThDMTkuMDQ0MSA3LjMyOTkxIDE5LjM5OTYgNi45MjUxMiAxOS41NzM1IDYuMzc5NzlDMTkuNzExNSA1Ljk0NjcgMTkuOTgzNyA0LjQ4ODEzIDE5Ljk4MzcgNC40ODgxM0MxOS45ODM3IDQuNDg4MTMgMjAuMjEwNSA1Ljg2Njg5IDIwLjMyMDUgNi4yNTkyOEMyMC41MTYgNi45NTUzMyAyMC45OCA3LjM4NDkyIDIxLjY2MDggNy42MDMzN0MyMi4zMzc0IDcuODIwNTUgMjMuMDM0NCA3LjkwMzg3IDIzLjczOTQgNy45NDQyNUMyMy44MTMyIDcuOTQ4MzggMjMuODg2OSA3Ljk1MzQ3IDIzLjk5OTUgNy45NjA3OEMyMy41NjA0IDguMDAwODUgMjMuMTU3MiA4LjAxNzA3IDIyLjc2MTYgOC4wODAwM0MyMi4zODE2IDguMTQwNzYgMjIuMDA1OCA4LjIzNjE1IDIxLjYzNSA4LjM0MTA5QzIwLjkzODYgOC41Mzc5MiAyMC41MTk5IDkuMDExNzEgMjAuMzA5IDkuNjk2NjNDMjAuMTIyMSAxMC4zMDQ2IDIwLjAwMzQgMTIuMjcxIDE5Ljk2NzEgMTIuOTAyMkMxOS45NjcxIDEyLjkwMjIgMTkuNzY0IDEwLjIzNDMgMTkuNjU2OSA5Ljc4MjQ5QzE5LjQ1MzcgOC45MjUyMiAxOC44NzI0IDguNDQ4ODggMTguMDM2OCA4LjIzOTY1QzE3LjQzMiA4LjA4ODI5IDE2LjgxNzkgOC4wMTkyOSAxNi4xOTc5IDcuOTkwMzZDMTYuMTE5NyA3Ljk4NjU0IDE2LjA0MTEgNy45ODI3MyAxNS45NjI5IDcuOTc4OTFDMTUuOTYyOSA3Ljk3NDQ2IDE1Ljk2MzUgNy45NjkzNyAxNS45NjM1IDcuOTY0OTJaIiBmaWxsPSJ1cmwoI3BhaW50MV9saW5lYXJfMF83OCkiLz4KPC9nPgo8ZGVmcz4KPGZpbHRlciBpZD0iZmlsdGVyMF9pXzBfNzgiIHg9IjEuODQ4NmUtMDUiIHk9IjQuODIzOTFlLTA1IiB3aWR0aD0iMjQuODE1NiIgaGVpZ2h0PSIyMC4wMDUzIiBmaWx0ZXJVbml0cz0idXNlclNwYWNlT25Vc2UiIGNvbG9yLWludGVycG9sYXRpb24tZmlsdGVycz0ic1JHQiI+CjxmZUZsb29kIGZsb29kLW9wYWNpdHk9IjAiIHJlc3VsdD0iQmFja2dyb3VuZEltYWdlRml4Ii8+CjxmZUJsZW5kIG1vZGU9Im5vcm1hbCIgaW49IlNvdXJjZUdyYXBoaWMiIGluMj0iQmFja2dyb3VuZEltYWdlRml4IiByZXN1bHQ9InNoYXBlIi8+CjxmZUNvbG9yTWF0cml4IGluPSJTb3VyY2VBbHBoYSIgdHlwZT0ibWF0cml4IiB2YWx1ZXM9IjAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDEyNyAwIiByZXN1bHQ9ImhhcmRBbHBoYSIvPgo8ZmVPZmZzZXQgZHg9IjIiIGR5PSIyIi8+CjxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjIiLz4KPGZlQ29tcG9zaXRlIGluMj0iaGFyZEFscGhhIiBvcGVyYXRvcj0iYXJpdGhtZXRpYyIgazI9Ii0xIiBrMz0iMSIvPgo8ZmVDb2xvck1hdHJpeCB0eXBlPSJtYXRyaXgiIHZhbHVlcz0iMCAwIDAgMCAxIDAgMCAwIDAgMSAwIDAgMCAwIDEgMCAwIDAgMC42IDAiLz4KPGZlQmxlbmQgbW9kZT0ibm9ybWFsIiBpbjI9InNoYXBlIiByZXN1bHQ9ImVmZmVjdDFfaW5uZXJTaGFkb3dfMF83OCIvPgo8L2ZpbHRlcj4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyXzBfNzgiIHgxPSI1LjIyNzc0IiB5MT0iMC41MDAxNjkiIHgyPSIxNC40Nzk4IiB5Mj0iMTcuMTEzMyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjREZGRjlBIi8+CjxzdG9wIG9mZnNldD0iMC4zOTcyMjYiIHN0b3AtY29sb3I9IiM4RkQ2MzQiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjQjhGODRBIi8+CjwvbGluZWFyR3JhZGllbnQ+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQxX2xpbmVhcl8wXzc4IiB4MT0iMTkuOTgxMiIgeTE9IjQuNDg4MTMiIHgyPSIxOS45ODEyIiB5Mj0iMTEuOTAyMiIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjQjhGODRBIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI0U1RkZDMiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+Cjwvc3ZnPgo=';
    function decorateMembershipBadge(option) {
      const name = option.querySelector('.model-name');
      if (!name) return;
      const required = window.vinaCanvasModelMembership?.needsMembership(option) || false;
      let badge = name.querySelector('.generation-model-membership-badge');
      if (!required) { badge?.remove(); return; }
      if (badge) return;
      badge = document.createElement('span');
      badge.className = 'generation-model-membership-badge';
      badge.setAttribute('aria-label', '会员模型');
      badge.title = '会员模型';
      const image = document.createElement('img');
      image.src = membershipDiamondSource;
      image.alt = '';
      image.draggable = false;
      image.setAttribute('aria-hidden', 'true');
      badge.appendChild(image);
      name.appendChild(badge);
    }
    function decorate(card) {
      const toggle = card.querySelector('.generation-card-expand');
      if (toggle) toggle.setAttribute('aria-expanded', String(card.classList.contains('expanded')));
      const prompt = card.querySelector('[data-generation-prompt-edit]');
      // 普通正文只读；编辑草稿独立承载输入，防止直接点击正文绕过保存或取消。
      if (prompt && prompt.getAttribute('contenteditable') !== 'false') prompt.setAttribute('contenteditable', 'false');
      if (prompt && !card.querySelector('.generation-card-edit')) {
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'generation-card-edit';
        edit.setAttribute('aria-label', '编辑提示词');
        edit.title = '编辑提示词';
        // ego 原图形内嵌成实际图片，避开背景图、遮罩以及旧主题图标规则的覆盖。
        const icon = document.createElement('img');
        icon.src = pencilSource;
        icon.alt = '';
        icon.setAttribute('aria-hidden', 'true');
        edit.appendChild(icon);
        edit.addEventListener('click', () => openPromptEditor(card));
        card.appendChild(edit);
      }
      const disabled = card.classList.contains('disabled');
      if (disabled && promptEditors.has(card)) closePromptEditor(card, false);
      const edit = card.querySelector('.generation-card-edit');
      if (edit) edit.disabled = disabled;
      const confirm = card.querySelector('[data-action="confirm-generation"]');
      if (confirm && card.dataset.confirmUiState === 'approved' && confirm.textContent !== '已确认') confirm.textContent = '已确认';
      card.querySelectorAll('[data-generation-param-key="model"]').forEach(option => {
        logo(option.querySelector('.model-icon'), option.dataset.generationParamValue);
        decorateMembershipBadge(option);
      });
      const modelLabel = card.querySelector('[data-generation-param-label="model"]');
      logo(card.querySelector('[data-generation-param-menu="model"]'), modelLabel?.textContent.trim());
    }
    // 只在原禁用流程结束后同步展示状态；批准、取消、失效和扣费仍全部由原函数完成。
    if (typeof disableGenerationCard === 'function') {
      const disable = disableGenerationCard;
      disableGenerationCard = function (card) {
        const request = typeof pendingGeneration !== 'undefined' ? pendingGeneration : null;
        const state = request?.card === card ? request.status : undefined;
        const result = disable.apply(this, arguments);
        if (card && state) {
          card.dataset.confirmUiState = state;
          decorate(card);
        }
        return result;
      };
    }
    // 2026-11-09 Product Design：原菜单进入浏览器 top layer，DOM 位置不变，保留 closest、参数收集和原事件链。
    // 避免移动菜单到 body 后破坏模型/滑杆逻辑，同时解除消息列表裁切与输入框的层叠遮挡。
    function positionMenus() {
      messages.querySelectorAll('.generation-param-controls .node-param-group').forEach(group => {
        const trigger = group.querySelector('.node-param-trigger');
        const menu = group.querySelector('.node-param-menu');
        if (!trigger || !menu) return;
        const open = group.classList.contains('open') && !group.closest('.generation-card')?.classList.contains('disabled');
        if (!open) {
          if (menu.matches(':popover-open')) menu.hidePopover();
          if (trigger.getAttribute('aria-expanded') !== 'false') trigger.setAttribute('aria-expanded', 'false');
          return;
        }
        // 2026-11-09：先标记浮层归属，旧定位器不再覆盖这里的向上定位。
        menu.setAttribute('data-confirmation-floating-menu', 'true');
        if (typeof menu.showPopover === 'function') {
          if (menu.getAttribute('popover') !== 'manual') menu.setAttribute('popover', 'manual');
          if (!menu.matches(':popover-open')) menu.showPopover();
        }
        // 2026-11-09 Product Design 修复：模型与其他参数统一从各自按钮上方向上浮出。
        // 按钮和确认卡不参与浮层尺寸计算；上方空间不足只限制菜单高度并在内部滚动。
        const rect = trigger.getBoundingClientRect();
        const viewport = window.visualViewport;
        const edge = 12;
        const gap = 8;
        const viewLeft = viewport?.offsetLeft || 0;
        const viewTop = viewport?.offsetTop || 0;
        const viewRight = viewLeft + (viewport?.width || window.innerWidth);
        const viewBottom = viewTop + (viewport?.height || window.innerHeight);
        const width = Math.min(432, viewRight - viewLeft - edge * 2);
        const left = Math.max(viewLeft + edge, Math.min(rect.left, viewRight - width - edge));
        menu.style.setProperty('width', width + 'px', 'important');
        menu.style.setProperty('left', left + 'px', 'important');
        const available = Math.floor(Math.max(0, rect.top - gap - viewTop - edge));
        // 按钮滚出可视区时暂时隐藏，滚回后由原 open 状态恢复，避免浮层停留在视口中间。
        if (available < 48 || rect.bottom <= viewTop || rect.top >= viewBottom) {
          if (menu.matches(':popover-open')) menu.hidePopover();
          menu.style.setProperty('visibility', 'hidden', 'important');
          trigger.setAttribute('aria-expanded', 'false');
          return;
        }
        menu.style.setProperty('visibility', 'visible', 'important');
        menu.style.setProperty('max-height', available + 'px', 'important');
        const height = menu.getBoundingClientRect().height;
        const top = rect.top - gap - height;
        menu.style.setProperty('top', top + 'px', 'important');
        trigger.setAttribute('aria-expanded', 'true');
      });
    }
    let frame = 0;
    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        messages.querySelectorAll('.generation-card').forEach(decorate);
        positionMenus();
      });
    }
    // 只监听展示相关的 class/disabled 和正文更新；样式写入不再触发自身观察器。
    new MutationObserver(schedule).observe(messages, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'disabled']
    });
    document.addEventListener('click', event => {
      if (event.target.closest('.generation-card')) schedule();
    });
    document.addEventListener('scroll', positionMenus, true);
    window.addEventListener('resize', schedule);
    // 2026-11-09：缩放或软键盘改变可视视口时，同步避让参数条。
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
