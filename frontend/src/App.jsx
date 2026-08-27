import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import StudentLogin from './pages/student/StudentLogin';
import StudentRegistration from './pages/student/StudentRegistration';
import StudentProfile from './pages/student/StudentProfile';
import PreviousLessonSummary from './pages/student/PreviousLessonSummary';
import AssistQuestionPage from './pages/cognitiveStyleAndLearnerProfile/Learner Profile/AssistQuestionPage';
import CalibrationPage from './pages/cognitiveStyleAndLearnerProfile/CognitiveStyle/Calibration/Calibration';
import Module2 from './pages/cognitiveStyleAndLearnerProfile/CognitiveStyle/SplitScreenModule/Module2';
import QuestionRunner from './pages/cognitiveStyleAndLearnerProfile/CognitiveStyle/GeftModule/QuestionRunner';
import AHSQuestionnaire from './pages/cognitiveStyleAndLearnerProfile/CognitiveStyle/GeftModule/AHS_Questionnaire/AHSQuestionnaire';
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
import DeepseekChat from './pages/DeepseekChat';
import StudentAnalyse from './pages/StudentAnalyse';
import ExamMaterialUpload from './pages/ExamMaterialUpload';
import ObjectSpacialVerbalQuestionnaire from './pages/cognitiveStyleAndLearnerProfile/CognitiveStyle/SplitScreenModule/ObjectSpacialVerbalQuestionnaire/ObjectSpacialVerbalQuestionnaire';
import GetExam from './pages/GetExam';
import NextLessonRecommendation from './pages/NextLessonRecommendation';
import TeacherPushBridge from './components/TeacherPushBridge';
import './index.css';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

// Simple PrivateRoute component (teacher routes)
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

const StudentRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const user = getStoredUser();
  const isStudent = Boolean(token && user?.role === 'Student');
  return isStudent ? children : <Navigate to="/student/login" replace />;
};

function App() {
  return (
    <Router>
      <TeacherPushBridge />
      <Routes>
        <Route path="/" element={<Navigate to="/course" replace />} />
        <Route path="/student/login" element={<StudentLogin />} />
        <Route path="/student/register" element={<StudentRegistration />} />
        <Route path="/student/profile" element={
          <StudentRoute>
            <StudentProfile />
          </StudentRoute>
        } />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/course/:courseId" element={
          <StudentRoute>
            <CourseDetail />
          </StudentRoute>
        } />
        <Route path="/course" element={
          <StudentRoute>
            <Course />
          </StudentRoute>
        } />
        <Route path="/learner-profile" element={<AssistQuestionPage />} />
        <Route path="/split-screen" element={<Module2 />} />
        <Route path="/geft" element={<QuestionRunner />} />
        <Route path="/calibration" element={<CalibrationPage />} />
        <Route path="/ahs-questionnaire" element={<AHSQuestionnaire />} />
        <Route path="/visualverbalquestionnaire" element={<ObjectSpacialVerbalQuestionnaire />} />

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
        <Route path="/deepseek" element={
          <PrivateRoute>
            <DeepseekChat />
          </PrivateRoute>
        } />
        <Route path="/next-lesson-recommendation" element={
          <PrivateRoute>
            <NextLessonRecommendation />
          </PrivateRoute>
        } />
        <Route path="/student-analyse" element={
          <PrivateRoute>
            <StudentAnalyse />
          </PrivateRoute>
        } />
        <Route path="/exam-materials" element={
          <PrivateRoute>
            <ExamMaterialUpload />
          </PrivateRoute>
        } />
        <Route path="/get-exam" element={
          <StudentRoute>
            <GetExam />
          </StudentRoute>
        } />
        <Route path="/student/previous-lesson-summary" element={
          <StudentRoute>
            <PreviousLessonSummary />
          </StudentRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
