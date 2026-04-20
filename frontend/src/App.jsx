import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import StudentLogin from './pages/student/StudentLogin';
import StudentRegistration from './pages/student/StudentRegistration';
import AssistQuestionPage from './pages/cognitiveStyleAndLearnerProfile/Learner Profile/AssistQuestionPage';
import Module2 from './pages/cognitiveStyleAndLearnerProfile/CognitiveStyle/SplitScreenModule/Module2';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import UploadsView from './pages/UploadsView';
import LessonUploadHub from './pages/LessonUploadHub';
import UploadNewLesson from './pages/UploadNewLesson';
import TeacherAnalysis from './pages/TeacherAnalysis';
import Course from './pages/Course';
import CourseDetail from './pages/CourseDetail';
import EditCourse from './pages/EditCourse';
import Gpt from './pages/Gpt';
import LessonSummary from './pages/LessonSummary';
import StudentAnalyse from './pages/StudentAnalyse';
import './index.css';

// Simple PrivateRoute component
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/student/login" element={<StudentLogin />} />
        <Route path="/student/register" element={<StudentRegistration />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/course/:courseId" element={<CourseDetail />} />
        <Route path="/course" element={<Course />} />
        <Route path="/learner-profile" element={<AssistQuestionPage />} />
        <Route path="/split-screen" element={<Module2 />} />
  


        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="/teacher-analysis" element={
          <PrivateRoute>
            <TeacherAnalysis />
          </PrivateRoute>
        } />
        <Route path="/upload-lesson" element={
          <PrivateRoute>
            <LessonUploadHub />
          </PrivateRoute>
        } />
        <Route path="/upload-new_lesson" element={
          <PrivateRoute>
            <UploadNewLesson />
          </PrivateRoute>
        } />
        <Route path="/upload-course/edit/:courseId" element={
          <PrivateRoute>
            <EditCourse />
          </PrivateRoute>
        } />
        <Route path="/upload" element={
          <PrivateRoute>
            <Upload />
          </PrivateRoute>
        } />
        <Route path="/uploads" element={
          <PrivateRoute>
            <UploadsView />
          </PrivateRoute>
        } />
        <Route path="/gpt" element={
          <PrivateRoute>
            <Gpt />
          </PrivateRoute>
        } />
        <Route path="/lesson-summary" element={
          <PrivateRoute>
            <LessonSummary />
          </PrivateRoute>
        } />
        <Route path="/student-analyse" element={
          <PrivateRoute>
            <StudentAnalyse />
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
