import { Route, Routes } from "react-router-dom";
import { PageLayout } from "./components/common/NavBar";
import useAuth from "./hooks/useAuth";

export default function App() {
  const { loading } = useAuth();
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
    </Routes>
  );
}
