import { For, Show, createMemo, createSignal } from 'solid-js';
import type { useCodingStore } from '../store/coding-store';

type Store = ReturnType<typeof useCodingStore>;

export function CreateThemeDialog(props: { store: Store; open: boolean; parentId?: string; onClose: () => void }) {
  const [name, setName] = createSignal('');
  const parent = () => props.store.state.themes.find((theme) => theme.id === props.parentId);
  const submit = () => {
    if (!name().trim()) return;
    props.store.addTheme(name().trim(), props.parentId ?? null);
    setName('');
    props.onClose();
  };
  return (
    <div class="modal-backdrop" classList={{ hidden: !props.open }} onClick={props.onClose}>
      <section class="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span class="eyebrow">THEME</span><h2>{parent() ? '添加子主题' : '创建一级主题'}</h2></div><button class="modal-close" onClick={props.onClose}>×</button></header>
        <Show when={parent()}><p class="modal-intro">父主题：<strong>{parent()!.name}</strong></p></Show>
        <label class="field-label">主题名称<input autofocus class="native-input full" value={name()} onInput={(event) => setName(event.currentTarget.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} placeholder="例如：教育中断" /></label>
        <footer><button class="button secondary" onClick={props.onClose}>取消</button><button class="button primary" disabled={!name().trim()} onClick={submit}>创建主题</button></footer>
      </section>
    </div>
  );
}

export function MoveThemeDialog(props: { store: Store; open: boolean; onClose: () => void }) {
  const [target, setTarget] = createSignal('');
  const source = () => props.store.state.themes.find((theme) => theme.id === props.store.state.activeThemeId);
  const isCycle = createMemo(() => {
    const current = source();
    return Boolean(current && target() && target() !== 'root' && props.store.wouldCreateCycle(current.id, target()));
  });
  const unchanged = createMemo(() => {
    const current = source();
    if (!current || !target()) return false;
    return current.parentId === (target() === 'root' ? null : target());
  });
  const previewPath = createMemo(() => {
    const current = source();
    if (!current || !target() || isCycle()) return '';
    if (target() === 'root') return current.name;
    const parentPath = props.store.themePath(target());
    return parentPath ? `${parentPath} / ${current.name}` : current.name;
  });
  const close = () => { setTarget(''); props.onClose(); };
  const submit = () => {
    const current = source();
    if (!current || !target() || isCycle() || unchanged()) return;
    props.store.moveTheme(current.id, target() === 'root' ? null : target());
    close();
  };
  return (
    <div class="modal-backdrop" classList={{ hidden: !props.open }} onClick={close}>
      <section class="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span class="eyebrow">MOVE</span><h2>移动主题</h2></div><button class="modal-close" onClick={close}>×</button></header>
        <p class="modal-intro">将「{source()?.name ?? '未选择'}」挂到新的位置，其下层子主题与已编码片段会一并跟随；编码册与主题记事中的主题路径将按新位置显示。此操作可通过撤销恢复。</p>
        <p class="modal-intro">当前路径：<strong>{source() ? props.store.themePath(source()!.id) : '—'}</strong></p>
        <label class="field-label">新父主题
          <select class="native-select full" value={target()} onChange={(event) => setTarget(event.currentTarget.value)}>
            <option value="">选择挂载位置</option>
            <option value="root">（移为一级主题）</option>
            <For each={props.store.orderedThemes()}>{(theme) => <option value={theme.id}>{theme.name}</option>}</For>
          </select>
        </label>
        <Show when={isCycle()}>
          <div class="warning-box">无法移动：所选目标是「{source()?.name}」自身或其下层子主题，挂过去会让主题路径绕成循环，编码册与主题记事将读不出完整层级。请改选其他位置。</div>
        </Show>
        <Show when={!isCycle() && unchanged()}>
          <div class="warning-box">该主题已经位于此位置，无需移动。</div>
        </Show>
        <Show when={!isCycle() && !unchanged() && previewPath()}>
          <div class="move-preview">移动后路径：{previewPath()}</div>
        </Show>
        <footer><button class="button secondary" onClick={close}>取消</button><button class="button primary" disabled={!target() || isCycle() || unchanged()} onClick={submit}>确认移动</button></footer>
      </section>
    </div>
  );
}

export function MergeThemeDialog(props: { store: Store; open: boolean; onClose: () => void }) {
  const [target, setTarget] = createSignal('');
  const source = () => props.store.state.themes.find((theme) => theme.id === props.store.state.activeThemeId);
  const candidates = createMemo(() => {
    const current = source();
    if (!current) return [];
    return props.store.orderedThemes().filter((theme) => !props.store.wouldCreateCycle(current.id, theme.id));
  });
  const submit = () => {
    if (source() && target()) props.store.mergeThemes(source()!.id, target());
    setTarget(() => '');
    props.onClose();
  };
  return (
    <div class="modal-backdrop" classList={{ hidden: !props.open }} onClick={props.onClose}>
      <section class="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span class="eyebrow">MERGE</span><h2>合并主题</h2></div><button class="modal-close" onClick={props.onClose}>×</button></header>
        <div class="warning-box">合并后，来源主题的所有片段编码与子主题会迁移到目标主题，原主题被删除。目标列表已排除其下层子主题，避免层级成环。此操作可通过撤销恢复。</div>
        <div class="merge-route"><strong>{source()?.name ?? '未选择'}</strong><span>→</span><select class="native-select" value={target()} onChange={(event) => setTarget(event.currentTarget.value)}><option value="">选择目标主题</option><For each={candidates()}>{(theme) => <option value={theme.id}>{theme.name}</option>}</For></select></div>
        <footer><button class="button secondary" onClick={props.onClose}>取消</button><button class="button danger" disabled={!target()} onClick={submit}>确认合并</button></footer>
      </section>
    </div>
  );
}

export function SplitThemeDialog(props: { store: Store; open: boolean; onClose: () => void }) {
  const [name, setName] = createSignal('');
  const [selected, setSelected] = createSignal<string[]>([]);
  const source = () => props.store.state.themes.find((theme) => theme.id === props.store.state.activeThemeId);
  const affected = createMemo(() => props.store.state.segments.filter((segment) => source() && (segment.assignments.A.includes(source()!.id) || segment.assignments.B.includes(source()!.id))));
  const submit = () => {
    if (source() && name().trim() && selected().length) props.store.splitTheme(source()!.id, name().trim(), selected());
    setName(''); setSelected([]);
    props.onClose();
  };
  return (
    <div class="modal-backdrop" classList={{ hidden: !props.open }} onClick={props.onClose}>
      <section class="modal-card wide" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span class="eyebrow">SPLIT</span><h2>从“{source()?.name}”拆分新主题</h2></div><button class="modal-close" onClick={props.onClose}>×</button></header>
        <p class="modal-intro">选择要迁入新主题的片段，其余片段继续保留在原主题。所有编码者的判断会一并迁移。</p>
        <label class="field-label">新主题名称<input class="native-input full" value={name()} onInput={(event) => setName(event.currentTarget.value)} placeholder="输入更具体的主题名称" /></label>
        <div class="split-list">
          <For each={affected()} fallback={<div class="empty-state">当前主题还没有可拆分的片段。</div>}>{(segment) => (
            <label class="split-item"><input type="checkbox" checked={selected().includes(segment.id)} onChange={(event) => setSelected((items) => event.currentTarget.checked ? [...items, segment.id] : items.filter((id) => id !== segment.id))} /><span>{segment.time} · {segment.speaker}<small>{segment.text}</small></span></label>
          )}</For>
        </div>
        <footer><button class="button secondary" onClick={props.onClose}>取消</button><button class="button primary" disabled={!name().trim() || !selected().length} onClick={submit}>拆分主题</button></footer>
      </section>
    </div>
  );
}
