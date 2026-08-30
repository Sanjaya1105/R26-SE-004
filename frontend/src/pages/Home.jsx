import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { getGatewayBaseUrl } from '../config/gateway';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '../config/brand';
import './Home.css';

const CONTACT_EMAIL = 'hello@lumora.learn';

function CourseThumb({ url, name }) {
  return (
    <div className="home-course-thumb">
      {url ? (
        <img src={url} alt={name || 'Course thumbnail'} />
      ) : (
        <span aria-hidden="true">L</span>
      )}
    </div>
  );
}

export default function Home() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({ name: '', email: '', message: '' });
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${getGatewayBaseUrl()}/api/public/courses`);
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        const previewable = list.filter(
          (course) =>
            course?.enrollmentOpen !== false &&
            (course?.readyLessonCount == null || Number(course.readyLessonCount) > 0)
        );
        if (!cancelled) setCourses(previewable.slice(0, 9));
      } catch {
        if (!cancelled) setCourses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitContact = (event) => {
    event.preventDefault();
    const subject = encodeURIComponent(`Lumora enquiry from ${contact.name || 'a visitor'}`);
    const body = encodeURIComponent(
      `${contact.message}\n\nFrom: ${contact.name}\nEmail: ${contact.email}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setContactSent(true);
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <a className="home-brand" href="#top">
          <span className="home-brand__mark" aria-hidden="true">
            L
          </span>
          <span>
            <strong>{PLATFORM_NAME}</strong>
            <small>{PLATFORM_TAGLINE}</small>
          </span>
        </a>
        <nav className="home-nav" aria-label="Homepage">
          <a href="#courses">Courses</a>
          <a href="#about">About us</a>
          <a href="#contact">Contact us</a>
        </nav>
        <div className="home-header__auth">
          <Link className="home-link-btn" to="/student/login">
            Log in
          </Link>
          <Link className="home-primary-btn" to="/student/register">
            Sign up
          </Link>
        </div>
      </header>

      <main>
        <section className="home-hero" id="top">
          <div className="home-hero__atmosphere" aria-hidden="true">
            <span className="home-hero__orb home-hero__orb--one" />
            <span className="home-hero__orb home-hero__orb--two" />
            <span className="home-hero__orb home-hero__orb--three" />
            <span className="home-hero__beam" />
            <span className="home-hero__spark home-hero__spark--a" />
            <span className="home-hero__spark home-hero__spark--b" />
            <span className="home-hero__spark home-hero__spark--c" />
          </div>
          <div className="home-hero__inner">
            <div className="home-hero__copy">
              <p className="home-kicker home-kicker--light">Student learning platform</p>
              <h1>Learn brighter with lessons that adapt to you.</h1>
              <p>
                Browse published courses, preview the first lecture, then create a
                free student account to unlock the rest — including personalized
                explanations matched to how you learn.
              </p>
              <div className="home-hero__actions">
                <a className="home-primary-btn home-hero__cta" href="#courses">
                  Preview courses
                </a>
                <Link className="home-ghost-btn home-hero__ghost" to="/student/register">
                  Create free account
                </Link>
              </div>
            </div>
            <aside className="home-hero__panel">
              <span className="home-hero__ring" aria-hidden="true" />
              <p className="home-hero__panel-kicker">1-minute preview</p>
              <strong>First lecture only</strong>
              <p>Sign in after 60 seconds to keep watching and enroll.</p>
              <div className="home-hero__meter" aria-hidden="true">
                <span />
              </div>
            </aside>
          </div>
          <a className="home-hero__scroll" href="#courses">
            Browse courses
          </a>
        </section>

        <section className="home-section" id="courses">
          <div className="home-section__heading">
            <p className="home-kicker">Course library</p>
            <h2>Preview a course without logging in</h2>
            <p>
              Open any course below. Other lessons stay locked until you log in.
              Enrollment is for students after sign-up.
            </p>
          </div>
          {loading ? (
            <p className="home-muted">Loading published courses…</p>
          ) : null}
          {!loading && courses.length === 0 ? (
            <p className="home-muted">
              No published courses are available to preview yet.
            </p>
          ) : null}
          {courses.length > 0 ? (
            <ul className="home-course-grid">
              {courses.map((course) => (
                <li key={String(course.id)}>
                  <Link
                    className="home-course-card"
                    to={`/course/${encodeURIComponent(String(course.id))}`}
                  >
                    <CourseThumb
                      url={course.thumbnailUrl}
                      name={course.courseName}
                    />
                    <div>
                      <h3>{course.courseName || 'Untitled course'}</h3>
                      <p>{course.educatorName || 'Educator'}</p>
                      <span>Preview first lecture</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="home-section home-section--about" id="about">
          <div className="home-section__heading">
            <p className="home-kicker">About us</p>
            <h2>Why {PLATFORM_NAME} exists</h2>
          </div>
          <div className="home-about-grid">
            <article>
              <h3>Personalized lessons</h3>
              <p>
                After you sign in, lessons can adapt to your cognitive style and
                live cognitive load so explanations stay clear instead of
                overwhelming.
              </p>
            </article>
            <article>
              <h3>Taught by educators</h3>
              <p>
                Teachers upload video, slides, and notes. You preview the opening
                lecture here, then continue the full path once you have an
                account.
              </p>
            </article>
            <article>
              <h3>Stay on track</h3>
              <p>
                Enrolled students get watch progress, exams, and next-lesson
                guidance. Guests can only sample the first minute of lecture one.
              </p>
            </article>
          </div>
        </section>

        <section className="home-section" id="contact">
          <div className="home-section__heading">
            <p className="home-kicker">Contact us</p>
            <h2>We would like to hear from you</h2>
            <p>
              Questions about a course, educator access, or the platform? Send a
              note and we will get back to you.
            </p>
          </div>
          <form className="home-contact" onSubmit={submitContact}>
            <label>
              Name
              <input
                type="text"
                name="name"
                value={contact.name}
                onChange={(event) =>
                  setContact((prev) => ({ ...prev, name: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                value={contact.email}
                onChange={(event) =>
                  setContact((prev) => ({ ...prev, email: event.target.value }))
                }
                required
              />
            </label>
            <label className="home-contact__full">
              Message
              <textarea
                name="message"
                rows={5}
                value={contact.message}
                onChange={(event) =>
                  setContact((prev) => ({
                    ...prev,
                    message: event.target.value,
                  }))
                }
                required
              />
            </label>
            <div className="home-contact__actions">
              <button type="submit" className="home-primary-btn">
                Send message
              </button>
              {contactSent ? (
                <p className="home-muted">Your email app should open next.</p>
              ) : (
                <p className="home-muted">{CONTACT_EMAIL}</p>
              )}
            </div>
          </form>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-footer__inner">
          <div>
            <strong>{PLATFORM_NAME}</strong>
            <p>{PLATFORM_TAGLINE}. Preview freely, then log in to learn the rest.</p>
          </div>
          <nav aria-label="Footer">
            <a href="#about">About us</a>
            <a href="#contact">Contact us</a>
            <Link to="/student/login">Student login</Link>
            <Link to="/student/register">Sign up</Link>
            <Link to="/login">Educator login</Link>
          </nav>
        </div>
        <p className="home-footer__legal">
          © {new Date().getFullYear()} {PLATFORM_NAME}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
