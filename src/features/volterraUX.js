/**
 * MyEV v18 — One shared style for native select menus.
 *
 * Does not change App.jsx, React state, component props, or source data.
 * Native <select> elements remain intact. On pointer/fine devices this
 * progressive enhancement shows a branded option popover and forwards
 * normal native `change` events to the existing React handlers.
 * Touch/pointer-coarse devices keep the accessible OS picker.
 */
import './volterraUX.css';

let active = null;

function isEligible(select) {
  return select instanceof HTMLSelectElement &&
    !select.disabled &&
    !select.multiple &&
    (!select.size || select.size === 1) &&
    !select.dataset.volterraNativeSelect;
}

function useNativePicker() {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

function menuOptions(select) {
  const list = [];

  for (const child of Array.from(select.children)) {
    if (child.tagName === 'OPTGROUP') {
      list.push({ group: child.label });
      for (const option of child.querySelectorAll('option')) {
        list.push({
          label: option.label || option.textContent || '',
          value: option.value,
          disabled: option.disabled || child.disabled,
          selected: option.selected,
        });
      }
    } else if (child.tagName === 'OPTION') {
      list.push({
        label: child.label || child.textContent || '',
        value: child.value,
        disabled: child.disabled,
        selected: child.selected,
      });
    }
  }

  return list;
}

function closeMenu({ restoreFocus = false } = {}) {
  if (!active) return;

  const { select, popover } = active;
  active = null;
  popover.remove();
  select.classList.remove('vlt-select-open');
  select.removeAttribute('aria-expanded');
  select.removeAttribute('aria-controls');
  if (restoreFocus && select.isConnected) {
    select.focus({ preventScroll: true });
  }
}

function highlight(index) {
  if (!active) return;

  const { items, buttons, popover } = active;
  if (!buttons.length) return;

  let next = index;
  // Disabled options are not keyboard-selectable.
  for (let i = 0; i < buttons.length; i += 1) {
    if (next < 0) next = buttons.length - 1;
    if (next >= buttons.length) next = 0;
    if (!items[next].disabled) break;
    next += 1;
  }

  if (items[next]?.disabled) return;
  active.highlightedIndex = next;

  buttons.forEach((button, i) => {
    button.classList.toggle('is-highlighted', i === next);
  });
  const selected = buttons[next];
  // Keep the list's scroll position, not the whole page's.
  if (selected && (selected.offsetTop < popover.scrollTop ||
    selected.offsetTop + selected.offsetHeight > popover.scrollTop + popover.clientHeight)) {
    selected.scrollIntoView({ block: 'nearest' });
  }
}

function choose(index) {
  if (!active) return;
  const { select, items } = active;
  const item = items[index];
  if (!item || item.disabled) return;

  // Update the real select: its React onChange and any form listeners
  // continue to work exactly as with a native selection.
  const changed = select.value !== item.value;
  // Invoke the platform's native setter so React's onChange can observe it
  // on controlled selects, without replacing the original select element.
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype, 'value'
  )?.set;
  if (setter) setter.call(select, item.value);
  else select.value = item.value;
  closeMenu({ restoreFocus: true });

  if (changed) {
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function positionMenu(select, popover) {
  if (!select.isConnected) return closeMenu();

  const rect = select.getBoundingClientRect();
  const padding = 10;
  const gap = 6;
  const availableBelow = innerHeight - rect.bottom - padding - gap;
  const availableAbove = rect.top - padding - gap;
  const displayBelow = availableBelow >= 190 || availableBelow >= availableAbove;
  const availableHeight = Math.max(90, displayBelow ? availableBelow : availableAbove);
  const width = Math.min(innerWidth - padding * 2, Math.max(rect.width, 190));

  popover.style.left = `${Math.max(padding, Math.min(rect.left, innerWidth - width - padding))}px`;
  popover.style.width = `${width}px`;
  popover.style.maxHeight = `${Math.min(320, availableHeight)}px`;
  // ScrollHeight includes all options even while the element is detached.
  const actualHeight = Math.min(320, availableHeight, popover.scrollHeight);
  popover.style.top = `${displayBelow
    ? Math.min(innerHeight - actualHeight - padding, rect.bottom + gap)
    : Math.max(padding, rect.top - actualHeight - gap)}px`;
}

function openMenu(select) {
  if (!isEligible(select) || useNativePicker()) return;
  if (active?.select === select) return closeMenu({ restoreFocus: true });
  closeMenu();

  const options = menuOptions(select);
  if (!options.some(option => !option.group && !option.disabled)) return;

  const popover = document.createElement('div');
  popover.className = 'vlt-dropdown-popover';
  popover.id = `vlt-dropdown-${Math.random().toString(36).slice(2, 10)}`;
  popover.setAttribute('role', 'listbox');
  popover.setAttribute('aria-label', select.getAttribute('aria-label') ||
    select.closest('label')?.textContent?.trim() || 'Select an option');
  popover.classList.toggle('is-dark', Boolean(select.closest('.theme-dark')));

  const items = [];
  const buttons = [];
  let currentIndex = 0;

  for (const option of options) {
    if ('group' in option) {
      const heading = document.createElement('div');
      heading.className = 'vlt-dropdown-group-label';
      heading.textContent = option.group;
      popover.appendChild(heading);
      continue;
    }

    const index = items.length;
    items.push(option);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'vlt-dropdown-option';
    row.textContent = option.label;
    row.disabled = option.disabled;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(option.selected));
    if (option.selected) {
      currentIndex = index;
      row.classList.add('is-selected');
    }
    row.addEventListener('pointerenter', () => highlight(index));
    row.addEventListener('click', () => choose(index));
    popover.appendChild(row);
    buttons.push(row);
  }

  document.body.appendChild(popover);
  active = { select, popover, buttons, items, highlightedIndex: currentIndex };
  select.classList.add('vlt-select-open');
  select.setAttribute('aria-expanded', 'true');
  select.setAttribute('aria-controls', popover.id);
  select.focus({ preventScroll: true });
  positionMenu(select, popover);

  // Focus the selected/first available row visually while the native
  // select retains keyboard focus and standard form semantics.
  if (items[currentIndex]?.disabled) currentIndex = items.findIndex(o => !o.disabled);
  highlight(Math.max(0, currentIndex));
}

// Register once. The listener also applies to selects React mounts later,
// including those in Forecasting, Policy, Market, and Geography pages.
if (typeof document !== 'undefined' && !window.__volterraDropdownUXInstalled) {
  window.__volterraDropdownUXInstalled = true;

  document.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.vlt-dropdown-popover')) return;

    const select = target.closest('select');
    if (select && isEligible(select) && !useNativePicker()) {
      event.preventDefault(); // Prevent default OS menu on mouse devices.
      openMenu(select);
      return;
    }
    if (active) closeMenu();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && active) {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !isEligible(target) || useNativePicker()) return;

    const supportedKeys = ['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!supportedKeys.includes(event.key)) {
      if (event.key === 'Tab' && active) closeMenu();
      return;
    }

    event.preventDefault();
    if (!active || active.select !== target) {
      openMenu(target);
      return;
    }

    switch (event.key) {
      case 'Enter':
      case ' ':
        choose(active.highlightedIndex);
        break;
      case 'ArrowDown':
        highlight(active.highlightedIndex + 1);
        break;
      case 'ArrowUp':
        highlight(active.highlightedIndex - 1);
        break;
      case 'Home':
        highlight(0);
        break;
      case 'End':
        highlight(active.buttons.length - 1);
        break;
    }
  }, true);

  document.addEventListener('focusin', (event) => {
    if (active && event.target !== active.select && !active.popover.contains(event.target)) {
      closeMenu();
    }
  });

  window.addEventListener('resize', () => {
    if (active) positionMenu(active.select, active.popover);
  }, { passive: true });

  document.addEventListener('scroll', (event) => {
    if (active && event.target !== active.popover) closeMenu();
  }, true);
}
