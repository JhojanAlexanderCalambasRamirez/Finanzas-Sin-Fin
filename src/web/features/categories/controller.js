import { categories } from '../../../domain/finance.js';
import { categoryList, saveCategory } from '../../../domain/movement-tools.js';

export function createCategoriesController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  persist,
  render,
  notify,
}) {
  let editingCategory = null;
  const categoryForm = $('#category-form');
  function renderCategoryManagement() {
    $('#category-list').replaceChildren();
    for (const category of categoryList(getState())) {
      const row = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = category.name;
      const count = getState().transactions.filter(
        (item) => item.category === category.name,
      ).length;
      const detail = document.createElement('small');
      detail.textContent = `${count} movimiento${count === 1 ? '' : 's'} · ${category.archived ? 'Archivada' : 'Activa'}`;
      label.append(detail);
      const actions = document.createElement('div');
      const edit = document.createElement('button');
      edit.className = 'secondary';
      edit.textContent = 'Renombrar';
      edit.setAttribute('aria-label', `Renombrar ${category.name}`);
      edit.onclick = () => openCategory(category.name);
      const archive = document.createElement('button');
      archive.className = 'secondary';
      archive.textContent = category.archived ? 'Reactivar' : 'Archivar';
      archive.setAttribute('aria-label', `${archive.textContent} ${category.name}`);
      archive.onclick = async () => {
        const categories = categoryList(getState()).map((item) =>
          item.name === category.name ? { ...item, archived: !item.archived } : item,
        );
        if (await persist({ ...getState(), categories })) {
          render();
          notify(
            category.archived
              ? 'Categoría reactivada.'
              : 'Categoría archivada. Su historial se conserva.',
          );
        }
      };
      actions.append(edit, archive);
      row.append(label, actions);
      $('#category-list').append(row);
    }
  }
  function openCategory(name = null) {
    editingCategory = name;
    categoryForm.reset();
    categoryForm.elements.name.value = name || '';
    $('#category-title').textContent = name ? 'Renombrar categoría' : 'Nueva categoría';
    $('#category-error').textContent = '';
    $('#category-dialog').showModal();
    categoryForm.elements.name.focus();
  }
  categoryForm.onsubmit = async (event) => {
    event.preventDefault();
    if (isSaving() || isProcessing() || !isReady()) return;
    try {
      const name = categoryForm.elements.name.value.trim();
      const next = saveCategory(getState(), editingCategory, name);
      if (await persist(next)) {
        if ($('#category-filter').value === editingCategory) {
          const option = $('#category-filter').selectedOptions[0];
          option.value = name;
        }
        render();
        $('#category-dialog').close();
        notify(
          editingCategory ? 'Categoría renombrada en todos sus movimientos.' : 'Categoría creada.',
        );
      }
    } catch (error) {
      $('#category-error').textContent = error.message;
    }
  };

  $('#new-category').onclick = () => openCategory();

  return { render: renderCategoryManagement };
}
