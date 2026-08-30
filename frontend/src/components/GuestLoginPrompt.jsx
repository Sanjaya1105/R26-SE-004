import { Link } from 'react-router-dom';
import './GuestLoginPrompt.css';

export default function GuestLoginPrompt({
  open,
  title = 'Sign in to continue',
  body = 'Create a free student account or log in to unlock the full lesson.',
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="guest-login-prompt" role="dialog" aria-modal="true" aria-labelledby="guest-login-title">
      <div className="guest-login-prompt__card">
        <p className="guest-login-prompt__kicker">Preview limit</p>
        <h2 id="guest-login-title">{title}</h2>
        <p>{body}</p>
        <div className="guest-login-prompt__actions">
          <Link className="guest-login-prompt__primary" to="/student/login">
            Log in
          </Link>
          <Link className="guest-login-prompt__secondary" to="/student/register">
            Sign up
          </Link>
        </div>
        {onClose ? (
          <button type="button" className="guest-login-prompt__dismiss" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}
