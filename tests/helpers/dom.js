// Minimal DOM double for controller wiring. It does not replace visual/browser tests.
export function createDomDouble(knownIds = null) {
  class Element {
    constructor() {
      this.children = [];
      this.value = '';
      this.textContent = '';
      this.hidden = false;
      this.disabled = false;
      this.dataset = {};
      this.style = {};
      this.listeners = new Map();
      this.classList = { toggle() {} };
      this.attributes = new Map();
      this.elements = new Proxy({}, { get: (target, key) => (target[key] ||= new Element()) });
    }
    get options() {
      return this.children;
    }
    get selectedOptions() {
      return this.children.filter((child) => child.value === this.value);
    }
    append(...nodes) {
      this.children.push(...nodes);
    }
    replaceChildren(...nodes) {
      this.children = [...nodes];
    }
    querySelector() {
      return new Element();
    }
    setAttribute(key, value) {
      this.attributes.set(key, value);
    }
    removeAttribute(key) {
      this.attributes.delete(key);
    }
    addEventListener(name, listener) {
      this.listeners.set(name, listener);
    }
    focus() {}
    reset() {}
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
      this.listeners.get('close')?.();
    }
    remove() {}
    async trigger(name) {
      return (this.listeners.get(name) || this['on' + name])?.({
        preventDefault() {},
        currentTarget: this,
      });
    }
  }
  const elements = new Map();
  const query = (selector) => {
    if (
      knownIds &&
      selector.startsWith('#') &&
      !selector.includes(' ') &&
      !knownIds.has(selector.slice(1))
    )
      throw new Error(`Selector ausente en HTML: ${selector}`);
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  return {
    query,
    document: {
      querySelector: query,
      querySelectorAll: () => [],
      createElement: () => new Element(),
      body: new Element(),
      getElementById: (id) => query('#' + id),
    },
    FormData: class {
      constructor(form) {
        this.form = form;
      }
      get(name) {
        return this.form.elements[name].value;
      }
    },
  };
}
