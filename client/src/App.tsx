import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import NewRecipe from "./pages/NewRecipe";
import RecipeDetail from "./pages/RecipeDetail";
import Browse from "./pages/Browse";
import BrowseDetail from "./pages/BrowseDetail";
import RecipeCompare from "./pages/RecipeCompare";
import { CompareFloatingButton } from "./components/CompareFloatingButton";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/recipes/new"} component={NewRecipe} />
      <Route path={"/recipes/compare/:ids"} component={RecipeCompare} />
      <Route path={"/recipes/:id"} component={RecipeDetail} />
      <Route path={"/browse"} component={Browse} />
      <Route path={"/browse/:id"} component={BrowseDetail} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
          <CompareFloatingButton />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
