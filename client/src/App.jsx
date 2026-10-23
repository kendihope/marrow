import { useEffect, useRef, useState } from 'react'
import './App.css'

const shelfSpines = [
  ['spruce', '11rem'], ['marigold', '8.5rem'], ['plum', '12.5rem'],
  ['tide', '9.5rem'], ['cherry', '11.5rem'], ['ink', '8rem'],
  ['marigold', '12rem'], ['spruce', '9rem'], ['plum', '10.5rem'],
]

function BookCard({ book, staffPick = false, onAdd }) {
  return (
    <article className="book-card">
      {book.image ? (
        <img className="book-card__cover" src={book.image} alt={`Cover of ${book.title} by ${book.author}: ${book.alt}`} width="400" height="600" loading="lazy" />
      ) : (
        <div className={`book-card__cover cover cover--${book.cover}`} aria-hidden="true">
          <span className="cover__imprint">MARROW STREET BOOKS</span>
          <span className="cover__title">{book.title}</span>
          <span className="cover__author">{book.author}</span>
          <span className="cover__ornament">✳</span>
        </div>
      )}
      <h3 className="book-card__title">{book.title}</h3>
      <p className="book-card__author">{book.author}</p>
      {staffPick && <p className="book-card__note"><span>{book.note}</span><strong>{book.by}</strong></p>}
      <div className="book-card__buy">
        <span className="book-card__price">${book.price}</span>
        <button className="button button--small" type="button" onClick={() => onAdd(book)} aria-label={`Add ${book.title} to your bag`}>Add to bag <span aria-hidden="true">+</span></button>
      </div>
    </article>
  )
}

function CatalogSection({ id, title, intro, items, staffPick = false, onAdd, kicker }) {
  return (
    <section className={`catalog${staffPick ? ' catalog--staff' : ''}`} id={id} aria-labelledby={`${id}-title`}>
      <div className="site-shell">
        <div className="section-heading">
          <div><p className="section-kicker">{kicker || (staffPick ? 'From behind the counter' : 'Browse the shelves')}</p><h2 id={`${id}-title`}>{title}</h2></div>
          <p>{intro}</p>
        </div>
        <ul className={`book-grid${staffPick ? ' book-grid--staff' : ''}`}>
          {items.map((book) => <li key={book.title}><BookCard book={book} staffPick={staffPick} onAdd={onAdd} /></li>)}
        </ul>
      </div>
    </section>
  )
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const data = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(data?.error || 'The request could not be completed.')
  return data
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [allBooks, setAllBooks] = useState([])
  const [events, setEvents] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [savedOrderId, setSavedOrderId] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState('bag')
  const [cart, setCart] = useState(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = JSON.parse(window.localStorage.getItem('marrow-bookbag') || '{}')
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
    } catch {
      return {}
    }
  })
  const [cartMessage, setCartMessage] = useState('')
  const [checkoutDetails, setCheckoutDetails] = useState({ name: '', email: '', note: '' })
  const [orderReady, setOrderReady] = useState(false)
  const books = {
    fiction: allBooks.filter((book) => book.category === 'fiction'),
    nonfiction: allBooks.filter((book) => book.category === 'nonfiction'),
    staff: allBooks.filter((book) => book.category === 'staff'),
  }
  const newArrivals = allBooks.filter((book) => book.isNewArrival)
  const reviews = books.staff.filter((book) => book.note).map((book) => ({ title: book.title, author: book.author, quote: book.note, by: book.by }))
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterMessage, setNewsletterMessage] = useState('')
  const cartDialogRef = useRef(null)
  const bagButtonRef = useRef(null)
  const closeMenu = () => setMenuOpen(false)
  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/api/books'), apiRequest('/api/events')])
      .then(([loadedBooks, loadedEvents]) => {
        if (!active) return
        setAllBooks(loadedBooks)
        setEvents(loadedEvents)
        setCatalogError('')
      })
      .catch((error) => { if (active) setCatalogError(error.message) })
      .finally(() => { if (active) setCatalogLoading(false) })
    apiRequest('/api/auth/session').then(({ user }) => {
      if (!active) return
      setAuthUser(user)
      if (user) setCheckoutDetails((current) => ({ ...current, name: current.name || user.name, email: current.email || user.email }))
    }).catch(() => {})
    return () => { active = false }
  }, [])

  const cartLines = Object.entries(cart)
    .map(([title, quantity]) => ({ book: allBooks.find((item) => item.title === title), quantity }))
    .filter((line) => line.book)
  const cartCount = cartLines.reduce((count, line) => count + line.quantity, 0)
  const subtotal = cartLines.reduce((amount, line) => amount + line.book.price * line.quantity, 0)

  useEffect(() => {
    try {
      window.localStorage.setItem('marrow-bookbag', JSON.stringify(cart))
    } catch {
      // The bag still works for this visit if browser storage is unavailable.
    }
  }, [cart])

  useEffect(() => {
    if (!cartOpen) return undefined
    const dialog = cartDialogRef.current
    dialog?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setCartOpen(false)
        requestAnimationFrame(() => bagButtonRef.current?.focus())
      }
      if (event.key === 'Tab' && dialog) {
        const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])')]
        const first = focusable[0]
        const last = focusable.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cartOpen])

  const addToCart = (book) => {
    setCart((items) => ({ ...items, [book.title]: (items[book.title] || 0) + 1 }))
    setCartMessage(`${book.title} added to your bag.`)
  }
  const updateQuantity = (title, quantity) => setCart((items) => {
    const updated = { ...items }
    if (quantity < 1) delete updated[title]
    else updated[title] = quantity
    return updated
  })
  const checkoutMailto = (() => {
    const lines = cartLines.map(({ book, quantity }) => `${quantity} × ${book.title} — $${book.price * quantity}`).join('\n')
    const body = [
      savedOrderId ? `Order request: #${savedOrderId}` : '',
      `Name: ${checkoutDetails.name}`,
      `Email: ${checkoutDetails.email}`,
      '',
      'Books requested:',
      lines,
      '',
      `Subtotal: $${subtotal}`,
      checkoutDetails.note ? `Note: ${checkoutDetails.note}` : '',
    ].filter(Boolean).join('\n')
    const subject = savedOrderId ? `Book order request #${savedOrderId}` : 'Book order request'
    return `mailto:books@marrowstreet.example?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  })()

  const openAuth = (mode = 'login') => {
    setAuthMode(mode)
    setAuthError('')
    setAuthOpen(true)
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    setAuthBusy(true)
    try {
      const payload = authMode === 'signup' ? authForm : { email: authForm.email, password: authForm.password }
      const { user } = await apiRequest(`/api/auth/${authMode}`, { method: 'POST', body: JSON.stringify(payload) })
      setAuthUser(user)
      setCheckoutDetails((current) => ({ ...current, name: current.name || user.name, email: current.email || user.email }))
      setAuthForm((current) => ({ ...current, password: '' }))
      setAuthOpen(false)
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
      setAuthUser(null)
    } catch (error) {
      setAuthError(error.message)
      setAuthOpen(true)
    }
  }

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault()
    setOrderError('')
    setSavedOrderId(null)
    if (!authUser) {
      setOrderError('Sign in to save this order request.')
      openAuth('login')
      return
    }
    try {
      const { order } = await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...checkoutDetails,
          items: cartLines.map(({ book, quantity }) => ({ productId: book.id, quantity })),
        }),
      })
      setSavedOrderId(order.id)
      setOrderReady(true)
    } catch (error) {
      setOrderError(error.message)
    }
  }

  const handleNewsletter = async (event) => {
    event.preventDefault()
    setNewsletterMessage('')
    try {
      await apiRequest('/api/newsletter', { method: 'POST', body: JSON.stringify({ email: newsletterEmail }) })
      const subject = encodeURIComponent('Newsletter signup')
      const body = encodeURIComponent(`Please add ${newsletterEmail} to the Marrow Street Books newsletter.`)
      window.location.href = `mailto:books@marrowstreet.example?subject=${subject}&body=${body}`
      setNewsletterMessage('Your signup is saved. Your email app can also open a request to the shop.')
      setNewsletterEmail('')
    } catch (error) {
      setNewsletterMessage(error.message)
    }
  }

  return (
    <div className="bookstore">
      <a className="skip-link" href="#main">Skip to content</a>
      <p className="sr-only" role="status" aria-live="polite">{cartMessage}</p>
      <header className="site-header" id="top" inert={cartOpen || authOpen}>
        <div className="site-shell site-header__inner">
          <a className="brand" href="#top"><span className="brand__mark" aria-hidden="true">m.</span><span>Marrow Street <i>Books</i></span></a>
          <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="main-navigation" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} onClick={() => setMenuOpen((open) => !open)}>
            <span /><span />
          </button>
          <nav id="main-navigation" className={`site-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
            <ul className="site-nav__list">
              <li><a href="#new-arrivals" onClick={closeMenu}>New arrivals</a></li>
              <li><a href="#fiction" onClick={closeMenu}>Fiction</a></li>
              <li><a href="#nonfiction" onClick={closeMenu}>Nonfiction</a></li>
              <li><a href="#staff-picks" onClick={closeMenu}>Staff picks</a></li>
              <li><a href="#reviews" onClick={closeMenu}>Reviews</a></li>
              <li><a href="#events" onClick={closeMenu}>Events</a></li>
              <li><a href="#newsletter" onClick={closeMenu}>Newsletter</a></li>
              <li><a href="#visit" onClick={closeMenu}>Visit</a></li>
            </ul>
          </nav>
          <div className="account-control">
            {authUser ? <><span className="account-name">{authUser.name}</span><button className="account-button" type="button" onClick={handleSignOut}>Sign out</button></> : <button className="account-button" type="button" onClick={() => openAuth('login')}>Sign in</button>}
          </div>
          <button ref={bagButtonRef} className="bag-button" type="button" onClick={() => { setCheckoutStep('bag'); setOrderReady(false); setCartOpen(true) }} aria-label={`Open shopping bag, ${cartCount} ${cartCount === 1 ? 'book' : 'books'}`}>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 8h14l1 12H4L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>
            <span>Bag</span><b aria-live="polite" aria-atomic="true">{cartCount}</b>
          </button>
        </div>
      </header>

      <main id="main" inert={cartOpen || authOpen}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="site-shell hero__inner">
            <div className="hero__copy">
              <p className="section-kicker">A neighborhood bookshop</p>
              <h1 id="hero-title">Books worth<br /><em>passing on.</em></h1>
              <p className="hero__lede">A small independent bookshop with a short, well-argued shelf. Browse the fiction, the nonfiction, and what the staff won't stop recommending, then come to a reading.</p>
              <div className="hero__actions">
                <a className="button button--solid" href="#fiction">Browse fiction <span aria-hidden="true">↘</span></a>
                <a className="quiet-link" href="#events">See events <span aria-hidden="true">→</span></a>
              </div>
              <p className="hero__aside"><span aria-hidden="true">✳</span> Thoughtfully picked.<br />Easy to pass along.</p>
            </div>
            <div className="hero__art" aria-hidden="true">
              <div className="hero__sun" />
              <div className="shelf">
                {shelfSpines.map(([color, height], index) => <span className={`spine spine--${color}`} style={{ '--spine-height': height }} key={`${color}-${index}`} />)}
              </div>
              <span className="hero__art-caption">Good books find good people.</span>
            </div>
          </div>
          <div className="hero__foot site-shell"><span>Selected with care, shared with pleasure.</span><a href="#fiction">Explore the shelves ↓</a></div>
        </section>

        {catalogLoading && <p className="api-notice" role="status">Loading the shelves…</p>}
        {catalogError && <p className="api-notice api-notice--error" role="alert">We couldn’t load the shop right now. {catalogError}</p>}
        <CatalogSection id="new-arrivals" title="New arrivals" intro="A fresh handful for the front table. Check back soon; this shelf changes as new books arrive." items={newArrivals} onAdd={addToCart} kicker="Just landed" />
        <CatalogSection id="fiction" title="Fiction" intro="Novels and story collections we've read, argued over, and kept on the front table." items={books.fiction} onAdd={addToCart} />
        <CatalogSection id="nonfiction" title="Nonfiction" intro="History, science, food, and the built world, written for people who like to know how things work." items={books.nonfiction} onAdd={addToCart} />
        <CatalogSection id="staff-picks" title="Staff picks" intro="Four books the people who work here keep handing across the counter." items={books.staff} staffPick onAdd={addToCart} />

        <section className="reviews" id="reviews" aria-labelledby="reviews-title">
          <div className="site-shell">
            <div className="section-heading">
              <div><p className="section-kicker">Notes from the counter</p><h2 id="reviews-title">Book reviews</h2></div>
              <p>Little reading notes from the booksellers, for the next person looking for a good book.</p>
            </div>
            <ul className="review-grid">
              {reviews.map((review) => (
                <li key={review.title}>
                  <article className="review-card">
                    <span className="review-card__mark" aria-hidden="true">“</span>
                    <blockquote>{review.quote}</blockquote>
                    <p className="review-card__book">{review.title}<span>by {review.author}</span></p>
                    <p className="review-card__byline">A note from {review.by}</p>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>



        <section className="events" id="events" aria-labelledby="events-title">
          <div className="site-shell">
            <div className="section-heading section-heading--events">
              <div><p className="section-kicker">Make a little room</p><h2 id="events-title">Events & gatherings</h2></div>
              <p>Readings and book clubs in the back room. Free to attend; email us to save a seat.</p>
            </div>
            <ul className="event-grid">
              {events.map((event) => (
                <li key={event.title}>
                  <article className="event-card">
                    <time className="event-date" dateTime={event.dateTime}><span>{event.month}</span><strong>{event.day}</strong></time>
                    <div className="event-card__body">
                      <p className="event-card__time">{event.time}</p>
                      <h3>{event.title}</h3>
                      <p className="event-card__description">{event.description}</p>
                      <a className="event-card__link" href={`mailto:events@marrowstreet.example?subject=${encodeURIComponent(`Seat: ${event.subject}`)}`} aria-label={`Save a seat at ${event.title}`}>Save a seat <span aria-hidden="true">→</span></a>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="newsletter" id="newsletter" aria-labelledby="newsletter-title">
          <div className="site-shell newsletter__inner">
            <div><p className="section-kicker">A letter from the shop</p><h2 id="newsletter-title">A good read,<br /><em>now and then.</em></h2></div>
            <div className="newsletter__copy">
              <p>New arrivals, bookseller notes, and a reason to stop by. A thoughtful little email, never a noisy one.</p>
              <form className="newsletter-form" onSubmit={handleNewsletter}>
                <label className="sr-only" htmlFor="newsletter-email">Your email address</label>
                <input id="newsletter-email" type="email" required value={newsletterEmail} placeholder="Your email address" onChange={(event) => setNewsletterEmail(event.target.value)} />
                <button type="submit">Sign me up <span aria-hidden="true">↗</span></button>
              </form>
              {newsletterMessage ? <p className="newsletter__message" role="status">{newsletterMessage}</p> : <small>One occasional note. Email the shop whenever you’d like to unsubscribe.</small>}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="visit" inert={cartOpen || authOpen}>
        <div className="site-shell site-footer__inner">
          <section aria-labelledby="visit-title"><p className="section-kicker">The door is open</p><h2 id="visit-title">Visit</h2><address>14 Marrow Street<br /><a href="mailto:books@marrowstreet.example">books@marrowstreet.example</a></address></section>
          <section aria-labelledby="hours-title"><p className="section-kicker">Plan a visit</p><h2 id="hours-title">Hours</h2><p>Tuesday to Saturday, 10 am to 6 pm<br />Sunday, 11 am to 4 pm<br />Closed Monday</p></section>
          <div className="footer-signoff"><a className="brand brand--footer" href="#top"><span className="brand__mark" aria-hidden="true">m.</span><span>Marrow Street <i>Books</i></span></a><p>For readers, near and far.</p></div>
          <p className="site-footer__legal">© 2026 Marrow Street Books</p>
        </div>
      </footer>

      {cartOpen && <div className="cart-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setCartOpen(false); requestAnimationFrame(() => bagButtonRef.current?.focus()) } }}>
        <section ref={cartDialogRef} className="cart-dialog" role="dialog" aria-modal="true" aria-labelledby="cart-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
          <button className="cart-close" type="button" aria-label="Close shopping bag" onClick={() => { setCartOpen(false); requestAnimationFrame(() => bagButtonRef.current?.focus()) }}>×</button>
          {checkoutStep === 'bag' ? <>
            <p className="section-kicker">Your little stack</p>
            <h2 id="cart-title">The book bag</h2>
            {cartLines.length ? <>
              <ul className="cart-lines">
                {cartLines.map(({ book, quantity }) => (
                  <li key={book.title}>
                    <div className="cart-line__book"><h3>{book.title}</h3><p>{book.author}</p><strong>${book.price}</strong></div>
                    <div className="quantity-control" role="group" aria-label={`Quantity of ${book.title}`}>
                      <button type="button" aria-label={`Remove one ${book.title}`} onClick={() => updateQuantity(book.title, quantity - 1)}>−</button>
                      <span>{quantity}</span>
                      <button type="button" aria-label={`Add one ${book.title}`} onClick={() => updateQuantity(book.title, quantity + 1)}>+</button>
                    </div>
                    <button className="remove-line" type="button" aria-label={`Remove ${book.title} from bag`} onClick={() => updateQuantity(book.title, 0)}>Remove</button>
                  </li>
                ))}
              </ul>
              <div className="cart-subtotal"><span>Subtotal <small>before any shop-confirmed fees</small></span><strong>${subtotal.toFixed(2)}</strong></div>
              <button className="button button--solid cart-continue" type="button" onClick={() => { setCheckoutStep('checkout'); setOrderReady(false) }}>Continue to checkout <span aria-hidden="true">→</span></button>
            </> : <div className="cart-empty"><span aria-hidden="true">✳</span><p>Your bag is waiting for a good story.</p><button className="quiet-link" type="button" onClick={() => setCartOpen(false)}>Back to the shelves <span aria-hidden="true">→</span></button></div>}
          </> : <>
            <button className="checkout-back" type="button" onClick={() => { setCheckoutStep('bag'); setOrderReady(false) }}>← Back to your bag</button>
            <p className="section-kicker">Almost there</p>
            <h2 id="cart-title">Order details</h2>
            <p className="checkout-explainer">This checkout sends an order request to the shop. The bookseller will confirm availability, pickup, and payment by email.</p>
            <form className="checkout-form" onSubmit={handleCheckoutSubmit}>
              <label>Full name<input required autoComplete="name" value={checkoutDetails.name} onChange={(event) => { setCheckoutDetails({ ...checkoutDetails, name: event.target.value }); setOrderReady(false) }} /></label>
              <label>Email address<input type="email" required autoComplete="email" value={checkoutDetails.email} onChange={(event) => { setCheckoutDetails({ ...checkoutDetails, email: event.target.value }); setOrderReady(false) }} /></label>
              <label>Note for the bookseller <span>(optional)</span><textarea rows="3" value={checkoutDetails.note} onChange={(event) => { setCheckoutDetails({ ...checkoutDetails, note: event.target.value }); setOrderReady(false) }} /></label>
              <div className="checkout-total"><span>{cartCount} {cartCount === 1 ? 'book' : 'books'}</span><strong>${subtotal.toFixed(2)}</strong></div>
              {orderError && <p className="form-error" role="alert">{orderError}</p>}
              {!orderReady ? <button className="button button--solid cart-continue" type="submit">{authUser ? 'Save order request' : 'Sign in to request these books'} <span aria-hidden="true">→</span></button> : <div className="order-ready" role="status"><p>Your order request #{savedOrderId} is saved. Open your email app to send the shop a copy.</p><a className="button button--solid cart-continue" href={checkoutMailto}>Send order request <span aria-hidden="true">↗</span></a></div>}
            </form>
          </>}
        </section>
      </div>}
      {authOpen && <div className="auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false) }}>
        <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button className="cart-close" type="button" aria-label="Close sign in" onClick={() => setAuthOpen(false)}>×</button>
          <p className="section-kicker">Your place at the shop</p>
          <h2 id="auth-title">{authMode === 'signup' ? 'Create an account' : 'Welcome back'}</h2>
          <form className="checkout-form" onSubmit={handleAuthSubmit}>
            {authMode === 'signup' && <label>Your name<input autoComplete="name" required maxLength={80} value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} /></label>}
            <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} /></label>
            <label>Password<input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required minLength={8} maxLength={72} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} /><small>At least 8 characters.</small></label>
            {authError && <p className="form-error" role="alert">{authError}</p>}
            <button className="button button--solid cart-continue" type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'} <span aria-hidden="true">→</span></button>
          </form>
          <p className="auth-switch">{authMode === 'signup' ? 'Already have an account?' : 'New to Marrow Street?'} <button type="button" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthError('') }}>{authMode === 'signup' ? 'Sign in' : 'Create an account'}</button></p>
        </section>
      </div>}
    </div>
  )
}

export default App
