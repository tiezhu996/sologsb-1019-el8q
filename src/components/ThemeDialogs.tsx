import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
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
  const ROOT = '__root__';
  const [target, setTarget] = createSignal('');
  const source = () => props.store.state.themes.find((theme) => theme.id === props.store.state.activeThemeId);
  createEffect(() => { if (props.open) setTarget(''); });

  const descendants = createMemo(() => {
    const current = source();
    if (!current) return new Set<string>();
    const ids = new Set<string>();
    let frontier = [current.id];
    while (frontier.length) {
      const children = props.store.state.themes.filter((theme) => theme.parentId !== null && frontier.includes(theme.parentId));
      children.forEach((theme) => ids.add(theme.id));
      frontier = children.map((theme) => theme.id);
    }
    return ids;
  });

  const affectedSegments = createMemo(() => {
    const current = source();
    if (!current) return 0;
    const ids = new Set([current.id, ...descendants()]);
    return props.store.state.segments.filter((segment) => segment.assignments.A.some((id) => ids.has(id)) || segment.assignments.B.some((id) => ids.has(id))).length;
  });

  const targetParentId = (): string | null | undefined => (target() === ROOT ? null : target() || undefined);

  const check = createMemo(() => {
    const current = source();
    const parentId = targetParentId();
    if (!current || parentId === undefined) return null;
    return props.store.moveThemeCheck(current.id, parentId);
  });

  const newPath = createMemo(() => {
    const current = source();
    const parentId = targetParentId();
    if (!current || parentId === undefined) return '';
    return parentId ? `${props.store.themePathLabel(parentId)} / ${current.name}` : current.name;
  });

  const submit = () => {
    const current = source();
    const parentId = targetParentId();
    if (!current || parentId === undefined) return;
    if (!props.store.moveTheme(current.id, parentId).ok) return;
    setTarget('');
    props.onClose();
  };

  return (
    <div class="modal-backdrop" classList={{ hidden: !props.open }} onClick={props.onClose}>
      <section class="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span class="eyebrow">MOVE</span><h2>移动主题</h2></div><button class="modal-close" onClick={props.onClose}>×</button></header>
        <Show when={source()} fallback={<p class="modal-intro">请先在主题树中选择要移动的主题。</p>}>
          {(current) => <>
            <p class="modal-intro">当前位置：<strong>{props.store.themePathLabel(current().id)}</strong></p>
            <div class="warning-box">移动后，{descendants().size} 个子主题与 {affectedSegments()} 条已编码片段会随“{current().name}”一起迁到新位置，编码册与主题记事中的主题路径按新位置显示。此操作可通过撤销恢复。</div>
            <label class="field-label">挂到
              <select class="native-select full" value={target()} onChange={(event) => setTarget(event.currentTarget.value)}>
                <option value="">选择新父主题</option>
                <option value={ROOT} disabled={!current().parentId}>（作为一级主题）{current().parentId ? '' : '—— 当前已是一级主题'}</option>
                <For each={props.store.orderedThemes()}>{(theme) => {
                  const blocked = () => {
                    if (theme.id === current().id) return '不能挂到它自己下面';
                    if (descendants().has(theme.id)) return '是它的下层主题，路径会绕成圈';
                    if (theme.id === current().parentId) return '当前父主题';
                    return '';
                  };
                  return <option value={theme.id} disabled={!!blocked()}>{theme.name}{blocked() ? `（${blocked()}）` : ''}</option>;
                }}</For>
              </select>
            </label>
            <Show when={check() && !check()!.ok}>
              <div class="disagreement">⚠ {check()!.reason}，确认前请另选位置。</div>
            </Show>
            <Show when={check()?.ok}>
              <div class="agreement">新位置：{newPath()}</div>
            </Show>
          </>}
        </Show>
        <footer><button class="button secondary" onClick={props.onClose}>取消</button><button class="button primary" disabled={!check()?.ok} onClick={submit}>确认移动</button></footer>
      </section>
    </div>
  );
}

export function MergeThemeDialog(props: { store: Store; open: boolean; onClose: () => void }) {
  const [target, setTarget] = createSignal('');
  const source = () => props.store.state.themes.find((theme) => theme.id === props.store.state.activeThemeId);
  const candidates = createMemo(() => {
    const current = source();
    if (!current) return props.store.orderedThemes();
    return props.store.orderedThemes().filter((theme) => !props.store.themePath(theme.id).some((item) => item.id === current.id));
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
        <div class="warning-box">合并后，来源主题的所有片段编码与子主题会迁移到目标主题，原主题被删除。此操作可通过撤销恢复。</div>
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
