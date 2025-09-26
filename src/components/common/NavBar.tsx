import { Button, Container, Nav, Navbar } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import useAuth from "../../hooks/useAuth";

// Tiny layout wrapper
export function PageLayout({
  children,
  admin,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  return (
    <>
      <NavBar admin={admin} />
      {children}
    </>
  );
}

export default function NavBar({ admin }: { admin?: boolean }) {
  return (
    <Navbar expand="lg" className="shadow-sm mb-4">
      <Container className="ms-1">
        {/* Brand (link to home) */}
        <LinkContainer to="/">
          <Navbar.Brand>Bllk Forms</Navbar.Brand>
        </LinkContainer>
        <Navbar.Toggle aria-controls="main-navbar" />
        <Navbar.Collapse id="main-navbar">
          {/* Left side links */}
          <Nav className="me-auto">
            {
              <LinkContainer to="/daily">
                <Nav.Link>Daily</Nav.Link>
              </LinkContainer>
            }
            {
              <LinkContainer to="/weekly">
                <Nav.Link>Weekly</Nav.Link>
              </LinkContainer>
            }
            {!admin && (
              <LinkContainer to="/admin">
                <Nav.Link>Admin</Nav.Link>
              </LinkContainer>
            )}
            {admin && (
              <LinkContainer to="/admin/builder">
                <Nav.Link>Builder</Nav.Link>
              </LinkContainer>
            )}
            {admin && (
              <LinkContainer to="/admin/submissions">
                <Nav.Link>Submissions</Nav.Link>
              </LinkContainer>
            )}
            {admin && (
              <LinkContainer to="/admin/staff">
                <Nav.Link>Staff</Nav.Link>
              </LinkContainer>
            )}
          </Nav>

          {/* Right side auth actions */}
          <Nav>
            {/* {!user && (
              <LinkContainer to="/login">
                <Button variant="primary" size="sm">
                  Login
                </Button>
              </LinkContainer>
            )} */}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
