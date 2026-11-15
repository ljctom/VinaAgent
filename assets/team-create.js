/* 2026-09-26 创建和编辑团队：统一在弹窗中处理名称和头像，不创建后台团队，不清空成员、项目、积分或席位。
 * 按用户要求，资料和新管理员身份仅在当前页面内存生效；刷新即恢复原演示状态，不写入存储或代码文件。
 * 图片校验真实解码结果，居中裁切到 256px 后在内存显示；未上传时使用团队首字。
 * 编辑弹窗先保存草稿；取消丢弃，保存后同步团队页和账户区域，普通成员不能编辑。
 */
(() => {
  'use strict';
  // 2026-09-26 用户补充：刷新可重置，团队资料不做本地持久化。
  let profile = null;

  const byId = (id) => document.getElementById(id);
  const paintAvatar = (element, name, avatar) => {
    if (!element) return;
    element.classList.toggle('team-uploaded-avatar', !!avatar);
    if (avatar) {
      // 仅使用解码后生成的本地数据 URL，用户文本不插入 HTML。
      const image = document.createElement('img');
      image.src = avatar;
      image.alt = '';
      element.replaceChildren(image);
    } else element.textContent = Array.from(name)[0] || '';
    element.setAttribute('aria-label', `${name}头像`);
  };
  const sync = () => {
    if (!profile) return;
    const option = document.querySelector('[data-profile-account="team"]');
    if (option) option.querySelector('strong').textContent = profile.name;
    byId('teamNameDisplay').textContent = profile.name;
    byId('profileAccountTeamName').textContent = profile.name;
    paintAvatar(option?.querySelector('.profile-account-avatar'), profile.name, profile.avatar);
    paintAvatar(byId('teamConsoleAvatar'), profile.name, profile.avatar);
    paintAvatar(byId('profileTeamAvatar'), profile.name, profile.avatar);
    const isTeam = document.querySelector('.global-account').classList.contains('is-team-account');
    if (isTeam) paintAvatar(byId('topAccountInitial'), profile.name, profile.avatar);
    else {
      byId('topAccountInitial').classList.remove('team-uploaded-avatar');
      byId('topAccountInitial').textContent = 'v';
    }
  };
  window.vinaCreatedTeam = {
    hasProfile: () => !!profile,
    sync,
    rename(name) {
      if (!profile) return;
      profile = { ...profile, name };
      sync();
    }
  };
  sync();

  const readAvatar = async (file) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 格式的图片');
    if (file.size > 5 * 1024 * 1024) throw new Error('图片不能超过 5 MB，请选择较小的图片');
    if (!file.size) throw new Error('图片为空，请重新选择');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片无法读取，请重新选择');
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      canvas.getContext('2d').drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
      return canvas.toDataURL('image/png');
    } catch (error) {
      throw new Error(error.message === '图片无法读取，请重新选择' ? error.message : '图片无法读取，请尝试其他图片');
    } finally { URL.revokeObjectURL(url); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.querySelector('.profile-account-create');
    if (!trigger) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'teamCreateDialog';
    dialog.className = 'team-create-dialog';
    dialog.setAttribute('aria-labelledby', 'teamCreateTitle');
    dialog.setAttribute('aria-describedby', 'teamCreateDescription');
    // Product Design：单列弹窗按说明、头像、名称、身份提示、操作排序，延续现有 Lucide 图标与绿色主按钮。
    // 2026-10-29 Product Design 展示改动：头像提示移到上传行下方，权限说明去掉装饰图标；仅调整创建弹窗模板，保留所有字段 ID、5 MB 限制、校验、提交与焦点逻辑，编辑团队弹窗不受影响。
    dialog.innerHTML = `
      <form id="teamCreateForm" novalidate>
        <div class="team-create-content">
          <header class="team-create-heading">
            <div><h2 id="teamCreateTitle">创建团队</h2><p class="team-create-description" id="teamCreateDescription">与成员一起创作，共同管理项目和资产</p></div>
            <button class="team-create-close" type="button" data-team-create-close aria-label="关闭创建团队"><img src="https://api.iconify.design/lucide/x.svg?color=%2398a5b1" alt=""></button>
          </header>
          <section class="team-create-avatar-section" aria-labelledby="teamCreateAvatarLabel">
            <div class="team-create-label" id="teamCreateAvatarLabel">团队头像<small>选填</small></div>
            <div class="team-create-avatar-row">
              <div class="team-create-avatar-preview" id="teamCreateAvatarPreview" role="img" aria-label="团队头像预览"></div>
              <div><div class="team-create-upload-actions"><button class="team-create-upload" id="teamCreateUpload" type="button">上传图片</button><button class="team-create-remove" id="teamCreateRemove" type="button" hidden>移除</button></div></div>
            </div>
            <p class="team-create-hint" id="teamCreateImageHint">JPG、PNG、WebP，不超过 5 MB<br>建议正方形，未上传时使用团队名称首字</p>
            <input id="teamCreateFile" type="file" accept="image/jpeg,image/png,image/webp" aria-label="上传团队头像" aria-describedby="teamCreateImageHint teamCreateImageError" hidden>
            <p class="team-create-error" id="teamCreateImageError" role="alert" hidden></p>
          </section>
          <div class="team-create-name-section">
            <label class="team-create-label" for="teamCreateName">团队名称<span class="team-create-required" aria-hidden="true"> *</span></label>
            <div class="team-create-input-wrap"><input id="teamCreateName" type="text" maxlength="24" required autocomplete="off" placeholder="给团队起个名字" aria-describedby="teamCreateNameHint teamCreateNameError" autofocus><span class="team-create-count" id="teamCreateCount">0/24</span></div>
            <p class="team-create-hint" id="teamCreateNameHint">最多 24 个字符，创建后可在团队管理中修改</p>
            <p class="team-create-error" id="teamCreateNameError" role="alert" hidden></p>
          </div>
          <aside class="team-create-note"><div><strong>你将成为团队管理员</strong><p>可邀请成员、管理项目和分配积分。<br>成员邀请和权限设置可在创建后完成。</p></div></aside>
        </div>
        <footer class="team-create-footer"><button type="button" data-team-create-close>取消</button><button class="team-create-submit" id="teamCreateSubmit" type="submit" disabled>创建团队</button></footer>
      </form>`;
    document.body.append(dialog);
    const form = byId('teamCreateForm');
    const nameInput = byId('teamCreateName');
    const fileInput = byId('teamCreateFile');
    const upload = byId('teamCreateUpload');
    const remove = byId('teamCreateRemove');
    const submit = byId('teamCreateSubmit');
    let avatar = '';
    let uploading = false;
    let submitting = false;
    let uploadVersion = 0;
    let created = false;
    const setError = (id, message = '') => {
      const element = byId(id);
      element.textContent = message;
      element.hidden = !message;
      if (id === 'teamCreateNameError') nameInput.setAttribute('aria-invalid', String(!!message));
    };
    const update = () => {
      const name = nameInput.value.trim();
      byId('teamCreateCount').textContent = `${nameInput.value.length}/24`;
      submit.disabled = !name || nameInput.value.length > 24 || uploading || submitting;
      upload.disabled = uploading || submitting;
      remove.disabled = submitting;
      remove.hidden = !avatar;
      upload.textContent = uploading ? '正在处理…' : avatar ? '更换图片' : '上传图片';
      if (avatar || name) paintAvatar(byId('teamCreateAvatarPreview'), name || '团队', avatar);
      else {
        const icon = document.createElement('img');
        icon.src = 'https://api.iconify.design/lucide/users-round.svg?color=%23b8f84a';
        icon.alt = '';
        icon.className = 'team-create-placeholder';
        byId('teamCreateAvatarPreview').replaceChildren(icon);
        byId('teamCreateAvatarPreview').setAttribute('aria-label', '团队头像预览');
      }
    };
    // 2026-10-23 Product Design 改动逻辑：账号菜单和侧栏团队入口共用创建流程，记录真实入口以便取消后恢复焦点；创建成功仍由原有事件切换管理员并进入团队管理。
    let createOpener = trigger;
    const openCreate = (opener = trigger) => {
      if (sessionStorage.getItem('vina-team-demo-member-id') !== 'pending' || window.vinaCreatedTeam.hasProfile() || dialog.open) return;
      createOpener = opener;
      form.reset();
      avatar = '';
      uploading = submitting = created = false;
      uploadVersion++;
      ['teamCreateNameError', 'teamCreateImageError'].forEach((id) => setError(id));
      submit.textContent = '创建团队';
      update();
      byId('profilePopover').hidden = true;
      byId('profileAccountPopover').hidden = true;
      byId('profilePopoverTrigger').setAttribute('aria-expanded', 'false');
      byId('profilePopoverTrigger').setAttribute('aria-label', '打开个人中心');
      byId('profileAccountSwitchTrigger').setAttribute('aria-expanded', 'false');
      dialog.showModal();
      nameInput.focus();
    };
    window.vinaCreatedTeam.openCreate = openCreate;
    trigger.addEventListener('click', () => openCreate(trigger));
    nameInput.addEventListener('input', () => {
      setError('teamCreateNameError', nameInput.value && !nameInput.value.trim() ? '团队名称不能只包含空格' : '');
      update();
    });
    nameInput.addEventListener('blur', () => {
      if (!nameInput.value.trim()) setError('teamCreateNameError', '请输入团队名称');
    });
    upload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      const version = ++uploadVersion;
      uploading = true;
      setError('teamCreateImageError');
      update();
      try {
        const result = await readAvatar(file);
        if (version === uploadVersion) avatar = result;
      } catch (error) {
        if (version === uploadVersion) setError('teamCreateImageError', error.message);
      } finally {
        if (version === uploadVersion) { uploading = false; update(); }
      }
    });
    remove.addEventListener('click', () => {
      uploadVersion++;
      uploading = false;
      avatar = '';
      setError('teamCreateImageError');
      update();
    });
    const close = () => { if (!submitting) dialog.close(); };
    dialog.querySelectorAll('[data-team-create-close]').forEach((button) => button.addEventListener('click', close));
    dialog.addEventListener('cancel', (event) => { if (submitting) event.preventDefault(); });
    dialog.addEventListener('click', (event) => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
    });
    dialog.addEventListener('close', () => {
      // 2026-10-23 改动逻辑：关闭使未完成的图片处理失效；侧栏发起时取消直接回到侧栏，菜单发起时恢复账号菜单，成功后由团队页接管焦点。
      uploadVersion++;
      if (created) return;
      if (createOpener !== trigger) {
        createOpener.focus({ preventScroll: true });
        return;
      }
      byId('profilePopover').hidden = false;
      byId('profileAccountPopover').hidden = false;
      byId('profilePopoverTrigger').setAttribute('aria-expanded', 'true');
      byId('profilePopoverTrigger').setAttribute('aria-label', '关闭个人中心');
      byId('profileAccountSwitchTrigger').setAttribute('aria-expanded', 'true');
      trigger.focus();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (uploading || submitting) return;
      const name = nameInput.value.trim();
      if (!name || nameInput.value.length > 24) {
        setError('teamCreateNameError', !name ? '请输入团队名称' : '团队名称不能超过 24 个字符');
        nameInput.focus();
        return;
      }
      submitting = true;
      submit.textContent = '创建中…';
      update();
      // 2026-09-26 创建资料只保存在内存；通过事件切为管理员，原演示身份不写回 sessionStorage，刷新恢复未加入状态。
      profile = { name, avatar };
      created = true;
      dialog.close();
      sync();
      window.dispatchEvent(new CustomEvent('vina:team-created'));
      configureAvatarEdit();
    });

    // 2026-09-26 Product Design：编辑复用创建弹窗的层级、字段样式和上传校验，移除创建身份提示。
    const editDialog = document.createElement('dialog');
    editDialog.id = 'teamEditDialog';
    editDialog.className = 'team-create-dialog';
    editDialog.setAttribute('aria-labelledby', 'teamEditTitle');
    editDialog.setAttribute('aria-describedby', 'teamEditDescription');
    // 2026-10-29 Product Design 展示调整：上传说明独占头像与按钮下方一行，字段 ID、aria 关联和全部编辑逻辑保持原样。
    editDialog.innerHTML = `
      <form id="teamEditForm" novalidate>
        <div class="team-create-content">
          <header class="team-create-heading">
            <div><h2 id="teamEditTitle">编辑团队</h2><p class="team-create-description" id="teamEditDescription">修改团队名称和头像</p></div>
            <button class="team-create-close" type="button" data-team-edit-close aria-label="关闭编辑团队"><img src="https://api.iconify.design/lucide/x.svg?color=%2398a5b1" alt=""></button>
          </header>
          <section class="team-create-avatar-section" aria-labelledby="teamEditAvatarLabel">
            <div class="team-create-label" id="teamEditAvatarLabel">团队头像<small>选填</small></div>
            <div class="team-create-avatar-row">
              <div class="team-create-avatar-preview" id="teamEditAvatarPreview" role="img" aria-label="团队头像预览"></div>
              <div><div class="team-create-upload-actions"><button class="team-create-upload" id="teamEditUpload" type="button">上传图片</button><button class="team-create-remove" id="teamEditRemove" type="button" hidden>移除</button></div></div>
            </div>
            <p class="team-create-hint" id="teamEditImageHint">JPG、PNG、WebP，不超过 5 MB<br>建议正方形，未上传时使用团队名称首字</p>
            <input id="teamEditFile" type="file" accept="image/jpeg,image/png,image/webp" aria-label="上传团队头像" aria-describedby="teamEditImageHint teamEditImageError" hidden>
            <p class="team-create-error" id="teamEditImageError" role="alert" hidden></p>
          </section>
          <div class="team-create-name-section">
            <label class="team-create-label" for="teamEditName">团队名称<span class="team-create-required" aria-hidden="true"> *</span></label>
            <div class="team-create-input-wrap"><input id="teamEditName" type="text" maxlength="24" required autocomplete="off" aria-describedby="teamEditNameHint teamEditNameError"><span class="team-create-count" id="teamEditCount">0/24</span></div>
            <p class="team-create-hint" id="teamEditNameHint">最多 24 个字符</p>
            <p class="team-create-error" id="teamEditNameError" role="alert" hidden></p>
          </div>
        </div>
        <footer class="team-create-footer"><button type="button" data-team-edit-close>取消</button><button class="team-create-submit" id="teamEditSubmit" type="submit">保存</button></footer>
      </form>`;
    document.body.append(editDialog);
    const editButton = byId('teamNameEdit');
    const consoleAvatar = byId('teamConsoleAvatar');
    const editForm = byId('teamEditForm');
    const editName = byId('teamEditName');
    const editFile = byId('teamEditFile');
    const editUpload = byId('teamEditUpload');
    const editRemove = byId('teamEditRemove');
    const editSubmit = byId('teamEditSubmit');
    const canEdit = () => !document.body.classList.contains('team-member-view') && !!window.vinaProjectTeam?.canManage();
    let editAvatar = '';
    let editUploading = false;
    let editVersion = 0;
    let editOpener = editButton;
    const editError = (id, message = '') => {
      const element = byId(id);
      element.textContent = message;
      element.hidden = !message;
      if (id === 'teamEditNameError') editName.setAttribute('aria-invalid', String(!!message));
    };
    const updateEdit = () => {
      const name = editName.value.trim();
      byId('teamEditCount').textContent = `${editName.value.length}/24`;
      editSubmit.disabled = !name || editUploading;
      editUpload.disabled = editUploading;
      editRemove.hidden = !editAvatar;
      editUpload.textContent = editUploading ? '正在处理…' : editAvatar ? '更换图片' : '上传图片';
      paintAvatar(byId('teamEditAvatarPreview'), name || '团队', editAvatar);
    };
    const openEdit = (opener) => {
      if (!canEdit()) return;
      editOpener = opener;
      editVersion++;
      editUploading = false;
      editName.value = profile?.name || byId('teamNameDisplay').textContent.trim();
      editAvatar = profile?.avatar || consoleAvatar.querySelector('img')?.src || '';
      editFile.value = '';
      editError('teamEditNameError');
      editError('teamEditImageError');
      updateEdit();
      editDialog.showModal();
      editName.focus();
    };
    function configureAvatarEdit() {
      if (!canEdit()) return;
      consoleAvatar.dataset.avatarEditable = 'true';
      consoleAvatar.setAttribute('role', 'button');
      consoleAvatar.tabIndex = 0;
      consoleAvatar.title = '编辑团队资料';
      consoleAvatar.setAttribute('aria-label', `${byId('teamNameDisplay').textContent}头像，点击编辑团队资料`);
    }
    editButton.addEventListener('click', () => openEdit(editButton));
    consoleAvatar.addEventListener('click', () => openEdit(consoleAvatar));
    consoleAvatar.addEventListener('keydown', (event) => {
      if (canEdit() && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openEdit(consoleAvatar); }
    });
    editName.addEventListener('input', () => {
      editError('teamEditNameError', editName.value && !editName.value.trim() ? '团队名称不能只包含空格' : '');
      updateEdit();
    });
    editName.addEventListener('blur', () => {
      if (!editName.value.trim()) editError('teamEditNameError', '请输入团队名称');
    });
    editUpload.addEventListener('click', () => editFile.click());
    editFile.addEventListener('change', async () => {
      const file = editFile.files[0];
      editFile.value = '';
      if (!file) return;
      const version = ++editVersion;
      editUploading = true;
      editError('teamEditImageError');
      updateEdit();
      try {
        const result = await readAvatar(file);
        if (version === editVersion && editDialog.open) editAvatar = result;
      } catch (error) {
        if (version === editVersion && editDialog.open) editError('teamEditImageError', error.message);
      } finally {
        if (version === editVersion) { editUploading = false; updateEdit(); }
      }
    });
    editRemove.addEventListener('click', () => {
      editVersion++;
      editUploading = false;
      editAvatar = '';
      editError('teamEditImageError');
      updateEdit();
    });
    editDialog.querySelectorAll('[data-team-edit-close]').forEach((button) => button.addEventListener('click', () => editDialog.close()));
    editDialog.addEventListener('click', (event) => {
      const rect = editDialog.getBoundingClientRect();
      if (event.target === editDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) editDialog.close();
    });
    editDialog.addEventListener('close', () => {
      // 关闭后废弃未完成的图片解码，恢复入口焦点；未保存的资料不会同步到页面。
      editVersion++;
      editOpener.focus({ preventScroll: true });
    });
    editForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (editUploading || !canEdit()) return;
      const name = editName.value.trim();
      if (!name || editName.value.length > 24) {
        editError('teamEditNameError', !name ? '请输入团队名称' : '团队名称不能超过 24 个字符');
        editName.focus();
        return;
      }
      // 保存时一次性提交名称和头像；现有演示团队与新建团队使用同一内存资料同步逻辑。
      profile = { name, avatar: editAvatar };
      sync();
      configureAvatarEdit();
      editDialog.close();
      const toast = byId('teamToast');
      toast.textContent = '团队资料已更新';
      toast.classList.add('is-visible');
      window.setTimeout(() => toast.classList.remove('is-visible'), 1900);
    });
    configureAvatarEdit();
  });
})();
