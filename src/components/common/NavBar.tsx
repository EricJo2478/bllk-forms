import { Button, Container, Nav, Navbar } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import useAuth from "../../hooks/useAuth";

// Tiny layout wrapper
export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}

export default function NavBar() {
  const { user } = useAuth();
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
            {/* <LinkContainer to="/daily">
              <Nav.Link>Daily</Nav.Link>
            </LinkContainer> */}
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
