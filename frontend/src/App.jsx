import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, Guard, useAuth } from './components/Auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Student from './pages/Student';
import Enrol from './pages/Enrol';
import Sessions from './pages/Sessions';
import SessionDetail from './pages/SessionDetail';
import Checkin from './pages/Checkin';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';
function Home() { const { user } = useAuth(); return user.role === 'student' ? <Student/> : <Analytics/>; }
const staff = element => <Guard roles={['teacher', 'admin']}>{element}</Guard>;
const student = element => <Guard roles={['student']}>{element}</Guard>;
export default function App() {
  return <AuthProvider><BrowserRouter><Routes><Route path="/login" element={<Login/>}/><Route element={<Guard><Layout/></Guard>}><Route index element={<Home/>}/><Route path="enrol" element={student(<Enrol/>)}/><Route path="checkin" element={student(<Checkin/>)}/><Route path="sessions" element={staff(<Sessions/>)}/><Route path="sessions/:id" element={staff(<SessionDetail/>)}/><Route path="analytics" element={staff(<Analytics/>)}/><Route path="admin" element={<Guard roles={['admin']}><Admin/></Guard>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></BrowserRouter></AuthProvider>;
}
