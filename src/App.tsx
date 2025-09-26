import { Route, Routes } from "react-router-dom";
import { PageLayout } from "./components/common/NavBar";
import useAuth from "./hooks/useAuth";
import FormRunnerPage from "./pages/FormRunnerPage";
import AdminGuard from "./contexts/AdminGuard";
import AdminFormBuilderPage from "./pages/AdminFormBuilderPage";
import LoginPage from "./pages/LoginPage";
import AdminSubmissionsPage from "./pages/AdminSubmissionsPage";
import AdminStaffPage from "./pages/AdminStaffPage";

export default function App() {
  const { loading, admin } = useAuth();
  if (loading) {
    return (
      <PageLayout>
        <div>Loading authentication status...</div>
      </PageLayout>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<PageLayout>{false}</PageLayout>} />
      <Route
        path="/daily"
        element={
          <PageLayout admin={admin}>
            <FormRunnerPage formId="daily" />
          </PageLayout>
        }
      />
      <Route
        path="/weekly"
        element={
          <PageLayout admin={admin}>
            <FormRunnerPage formId="weekly" />
          </PageLayout>
        }
      />
      <Route
        path="/admin/builder"
        element={
          <AdminGuard>
            <PageLayout admin>
              <AdminFormBuilderPage />
            </PageLayout>
          </AdminGuard>
        }
      />
      <Route
        path="/admin/submissions"
        element={
          <AdminGuard>
            <PageLayout admin>
              <AdminSubmissionsPage />
            </PageLayout>
          </AdminGuard>
        }
      />
      <Route
        path="/admin/staff"
        element={
          <AdminGuard>
            <PageLayout admin>
              <AdminStaffPage />
            </PageLayout>
          </AdminGuard>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminGuard>
            <PageLayout admin>
              <PageLayout admin>{false}</PageLayout>
            </PageLayout>
          </AdminGuard>
        }
      />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}
