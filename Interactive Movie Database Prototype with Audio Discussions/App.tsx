import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AudioRoomProvider } from "./contexts/AudioRoomContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import FloatingAudioPlayer from "./components/FloatingAudioPlayer";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import MovieDetail from "./pages/MovieDetail";
import PersonProfile from "./pages/PersonProfile";
import UserProfile from "./pages/UserProfile";
import Watchlist from "./pages/Watchlist";
import Rooms from "./pages/Rooms";
import RoomDetail from "./pages/RoomDetail";
import ThreadDetail from "./pages/ThreadDetail";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <FloatingAudioPlayer />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Layout><Home /></Layout>} />
      <Route path="/browse" component={() => <Layout><Browse /></Layout>} />
      <Route path="/movie/:slug" component={() => <Layout><MovieDetail /></Layout>} />
      <Route path="/movie/:slug/thread/:threadId" component={() => <Layout><ThreadDetail /></Layout>} />
      <Route path="/person/:slug" component={() => <Layout><PersonProfile /></Layout>} />
      <Route path="/profile" component={() => <Layout><UserProfile /></Layout>} />
      <Route path="/watchlist" component={() => <Layout><Watchlist /></Layout>} />
      <Route path="/rooms" component={() => <Layout><Rooms /></Layout>} />
      <Route path="/rooms/:slug" component={() => <Layout><RoomDetail /></Layout>} />
      <Route path="/404" component={() => <Layout><NotFound /></Layout>} />
      <Route component={() => <Layout><NotFound /></Layout>} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AudioRoomProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AudioRoomProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
