import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <main className="page landing-page">
      <section className="hero">
        <p className="eyebrow">DRUE</p>
        <h1>Your tasks live everywhere, meet your tasks where they live.</h1>
        <p className="hero-copy">
          Drue starts with email and turns message noise into a focused next-action list.
        </p>
        <div className="hero-actions">
          <Link to="/login" className="button primary">
            Continue with Google
          </Link>
          <a href="#how" className="button ghost">
            Learn more
          </a>
        </div>
      </section>
      <section id="how" className="feature-strip">
        <article>
          <h2>Email first</h2>
          <p>Connect Gmail and let Drue identify tasks hidden in threads.</p>
        </article>
        <article>
          <h2>One queue</h2>
          <p>No more context switching across inboxes and note apps.</p>
        </article>
        <article>
          <h2>Built for follow-through</h2>
          <p>Keep momentum with one clean list and clear ownership.</p>
        </article>
      </section>
    </main>
  );
}
