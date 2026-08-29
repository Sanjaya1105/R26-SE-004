import StudentFooter from './StudentFooter';
import './StudentFooter.css';

export default function StudentAppShell({ children }) {
  return (
    <div className="student-app-shell">
      <div className="student-app-shell__body">{children}</div>
      <StudentFooter />
    </div>
  );
}
