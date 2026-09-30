// ===== Настройки =====
// Ссылка на веб-приложение Google Apps Script, которое записывает заказы в таблицу.
// Как получить — см. google-apps-script.gs. Пока пусто, заказы никуда не отправляются.
const ORDERS_URL = 'https://script.google.com/macros/s/AKfycby7bSgaEVA4WQz3TRgzOpH8iaG6lhuOc52--lTYvBbmR-dV0R3QNOUOo8S0m23217RFt3qMGQ/exec';

// ===== Данные =====
const CDN = 'https://static.tildacdn.com/';
const OPTIM = 'https://optim.tildacdn.com/';

// Лёгкая webp-версия фото с CDN Tilda; при ошибке подставляем оригинал
const thumb = (path) => {
  const i = path.lastIndexOf('/');
  return `${OPTIM}${path.slice(0, i)}/-/resize/600x/-/format/webp/${path.slice(i + 1)}.webp`;
};

const products = [];
const categories = MENU.map(([title, icon, items], ci) => {
  const id = 'cat-' + ci;
  const list = items.map(([name, price, desc, badge, img], i) => {
    const p = { id: `${ci}-${i}`, name, price, desc, badge, img, cat: id };
    products.push(p);
    return p;
  });
  return { id, title, icon, items: list };
});
const byId = Object.fromEntries(products.map((p) => [p.id, p]));

// ===== Утилиты =====
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const rub = (n) => n.toLocaleString('ru-RU') + ' ₽';
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function badgeHTML(b) {
  if (!b) return '';
  const map = { 'ХИТ': 'hit', 'NEW': 'new', 'НОВИНКА': 'new', 'ОСТРО': 'hot', 'без доставки': 'hall' };
  const label = { 'NEW': 'Новинка', 'НОВИНКА': 'Новинка', 'ХИТ': 'Хит', 'ОСТРО': '🌶 Остро', 'без доставки': 'Только в зале' }[b] || b;
  return `<span class="badge badge--${map[b] || 'hit'}">${label}</span>`;
}

function imgHTML(p) {
  return `<img src="${thumb(p.img)}" data-orig="${CDN + p.img}" alt="${esc(p.name)}" loading="lazy">`;
}

// Плавное появление фото и запасной вариант при ошибке
document.addEventListener('load', (e) => {
  if (e.target.tagName === 'IMG') e.target.classList.add('loaded');
}, true);
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName === 'IMG' && img.dataset.orig && img.src !== img.dataset.orig) img.src = img.dataset.orig;
}, true);

// ===== Корзина: состояние =====
const cart = new Map();
try {
  const saved = JSON.parse(localStorage.getItem('okpizza-cart') || '[]');
  saved.forEach(([id, qty]) => byId[id] && cart.set(id, qty));
} catch (e) { /* хранилище недоступно — начинаем с пустой корзины */ }

function saveCart() {
  try { localStorage.setItem('okpizza-cart', JSON.stringify([...cart])); } catch (e) {}
}

function controlHTML(id) {
  const qty = cart.get(id) || 0;
  if (!qty) return `<button class="add" data-add="${id}">В корзину</button>`;
  return `<div class="stepper"><button data-dec="${id}" aria-label="Убрать одну">−</button><span>${qty}</span><button data-inc="${id}" aria-label="Добавить ещё">+</button></div>`;
}

function cardHTML(p, cls = 'card') {
  return `
    <article class="${cls}" data-id="${p.id}">
      <div class="card__img">${badgeHTML(p.badge)}${imgHTML(p)}</div>
      <div class="card__body">
        <h4 class="card__name">${esc(p.name)}</h4>
        ${p.desc ? `<p class="card__desc">${esc(p.desc)}</p>` : ''}
        <div class="card__foot">
          <span class="price">${rub(p.price)}</span>
          <div class="ctrl" data-ctrl="${p.id}">${controlHTML(p.id)}</div>
        </div>
      </div>
    </article>`;
}

// ===== Хиты =====
const pizzaNews = categories[2].items.slice(0, 3).concat(categories[1].items.filter((p) => p.badge));
const hits = products.filter((p) => p.badge === 'ХИТ').concat(pizzaNews);
$('#hitsTrack').innerHTML = hits.map((p) => cardHTML(p, 'hit')).join('');
$('#hitsPrev').addEventListener('click', () => $('#hitsTrack').scrollBy({ left: -640, behavior: 'smooth' }));
$('#hitsNext').addEventListener('click', () => $('#hitsTrack').scrollBy({ left: 640, behavior: 'smooth' }));

// ===== Меню и категории =====
$('#catsScroll').innerHTML = categories.map((c) =>
  `<a class="cat" href="#${c.id}" data-cat="${c.id}"><span>${c.icon}</span>${c.title}</a>`).join('');

$('#menuSections').innerHTML = categories.map((c) => `
  <section class="menu-section" id="${c.id}">
    <h3>${c.title} <small>${c.items.length}</small></h3>
    <div class="grid">${c.items.map((p) => cardHTML(p)).join('')}</div>
  </section>`).join('');

// Подсветка активной категории при прокрутке
const catLinks = Object.fromEntries($$('.cat').map((a) => [a.dataset.cat, a]));
function setActiveCat(id) {
  $$('.cat.is-active').forEach((a) => a.classList.remove('is-active'));
  const a = catLinks[id];
  if (!a) return;
  a.classList.add('is-active');
  const box = $('#catsScroll');
  box.scrollTo({ left: a.offsetLeft - box.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
}
const spy = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) setActiveCat(e.target.id); });
}, { rootMargin: '-160px 0px -60% 0px' });
$$('.menu-section').forEach((s) => spy.observe(s));

// ===== Поиск =====
$('#search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  let visible = 0;
  $$('.menu-section').forEach((sec) => {
    let n = 0;
    $$('.card', sec).forEach((card) => {
      const p = byId[card.dataset.id];
      const ok = !q || (p.name + ' ' + p.desc).toLowerCase().includes(q);
      card.hidden = !ok;
      if (ok) n++;
    });
    sec.hidden = n === 0;
    visible += n;
  });
  $('#emptySearch').hidden = visible > 0;
  $('#cats').hidden = !!q;
});

// ===== Корзина: действия =====
function changeQty(id, delta) {
  const qty = (cart.get(id) || 0) + delta;
  if (qty <= 0) cart.delete(id); else cart.set(id, qty);
  saveCart();
  $$(`[data-ctrl="${id}"]`).forEach((el) => (el.innerHTML = controlHTML(id)));
  renderCart();
  if (delta > 0) {
    const btn = $('#cartBtn');
    btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
  }
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-add],[data-inc],[data-dec]');
  if (!t) return;
  if (t.dataset.add) { changeQty(t.dataset.add, 1); toast(`«${byId[t.dataset.add].name}» в корзине`); }
  if (t.dataset.inc) changeQty(t.dataset.inc, 1);
  if (t.dataset.dec) changeQty(t.dataset.dec, -1);
});

function totals() {
  let sum = 0, count = 0;
  cart.forEach((q, id) => { sum += byId[id].price * q; count += q; });
  return { sum, count };
}

function renderCart() {
  const { sum, count } = totals();
  $('#cartBtnSum').textContent = count ? rub(sum) : 'Корзина';
  $('#cartBtnCount').hidden = !count;
  $('#cartBtnCount').textContent = count;
  $('#mobileCart').hidden = !count;
  $('#mobileCartCount').textContent = count;
  $('#mobileCartSum').textContent = rub(sum);
  $('#cartTotal').textContent = rub(sum);

  $('#cartList').innerHTML = count ? [...cart].map(([id, q]) => {
    const p = byId[id];
    return `<li class="cart-item">
      ${imgHTML(p)}
      <div class="cart-item__info">
        <div class="cart-item__name">${esc(p.name)}</div>
        <div class="cart-item__price">${rub(p.price * q)}</div>
      </div>
      <div class="stepper"><button data-dec="${id}" aria-label="Убрать одну">−</button><span>${q}</span><button data-inc="${id}" aria-label="Добавить ещё">+</button></div>
    </li>`;
  }).join('') : `<li class="cart-empty"><div>🛒</div><b>Корзина пуста</b>Добавьте что-нибудь вкусное из меню</li>`;

  if (step === 'cart') $('#drawerAction').disabled = !count;
  updateDeliveryNotice();
}

// ===== Корзина: шаги =====
let step = 'cart';
function setStep(s) {
  step = s;
  $('#stepCart').hidden = s !== 'cart';
  $('#stepCheckout').hidden = s !== 'checkout';
  $('#stepSuccess').hidden = s !== 'success';
  $('#drawerBack').hidden = s !== 'checkout';
  $('#drawerTitle').textContent = { cart: 'Ваш заказ', checkout: 'Оформление', success: 'Готово' }[s];
  const act = $('#drawerAction');
  act.textContent = { cart: 'Перейти к оформлению', checkout: 'Подтвердить заказ', success: 'Вернуться в меню' }[s];
  act.disabled = s === 'cart' && !cart.size;
  $('.drawer__total').hidden = s === 'success';
}

function openCart() {
  if (step === 'success') setStep('cart');
  document.body.classList.add('cart-open');
  $('#drawer').setAttribute('aria-hidden', 'false');
}
function closeCart() {
  document.body.classList.remove('cart-open');
  $('#drawer').setAttribute('aria-hidden', 'true');
}
$('#cartBtn').addEventListener('click', openCart);
$('#mobileCart').addEventListener('click', openCart);
$('#drawerClose').addEventListener('click', closeCart);
$('#overlay').addEventListener('click', closeCart);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });
$('#drawerBack').addEventListener('click', () => setStep('cart'));

const form = $('#stepCheckout');
const isDelivery = () => form.mode.value === 'delivery';

function updateDeliveryNotice() {
  const hallOnly = [...cart.keys()].some((id) => byId[id].badge === 'без доставки');
  $('#noDeliveryNotice').hidden = !(hallOnly && isDelivery());
}
form.addEventListener('change', () => {
  $('#addressField').hidden = !isDelivery();
  updateDeliveryNotice();
});

$('#drawerAction').addEventListener('click', () => {
  if (step === 'cart') return cart.size && setStep('checkout');
  if (step === 'success') { closeCart(); return; }

  // Проверка формы
  const need = ['name', 'phone'].concat(isDelivery() ? ['address'] : []);
  let ok = true;
  need.forEach((n) => {
    const field = form[n].closest('.field');
    const bad = n === 'phone' ? form[n].value.replace(/\D/g, '').length < 10 : !form[n].value.trim();
    field.classList.toggle('is-invalid', bad);
    if (bad) ok = false;
  });
  if (!ok) return toast('Заполните отмеченные поля');
  sendOrder();
});

async function sendOrder() {
  const btn = $('#drawerAction');
  const { sum } = totals();
  const order = {
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    mode: isDelivery() ? 'Доставка' : 'Самовывоз',
    place: form.place.value,
    address: isDelivery() ? form.address.value.trim() : '',
    items: [...cart].map(([id, q]) => `${byId[id].name} × ${q}`).join(', '),
    total: sum,
    comment: form.comment.value.trim(),
  };

  if (!ORDERS_URL) {
    console.warn('ORDERS_URL не задан — заказ не отправлен в таблицу', order);
  } else {
    btn.disabled = true;
    btn.textContent = 'Отправляем…';
    try {
      // text/plain + no-cors — Google Apps Script принимает такой запрос без CORS-проверки
      await fetch(ORDERS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(order) });
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Подтвердить заказ';
      return toast('Не удалось отправить заказ. Проверьте интернет или позвоните нам');
    }
    btn.disabled = false;
  }

  cart.clear();
  saveCart();
  $$('[data-ctrl]').forEach((el) => (el.innerHTML = controlHTML(el.dataset.ctrl)));
  form.reset();
  $('#addressField').hidden = false;
  renderCart();
  setStep('success');
}
form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('is-invalid'));

// ===== Уведомление =====
let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-shown'), 2200);
}

// ===== Шапка и мобильная навигация =====
addEventListener('scroll', () => $('#header').classList.toggle('is-scrolled', scrollY > 40), { passive: true });
$('#navToggle').addEventListener('click', () => {
  $('#navToggle').classList.toggle('is-open');
  $('#nav').classList.toggle('is-open');
});
$$('#nav a').forEach((a) => a.addEventListener('click', () => {
  $('#navToggle').classList.remove('is-open');
  $('#nav').classList.remove('is-open');
}));

setStep('cart');
renderCart();
