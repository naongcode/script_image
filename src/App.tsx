import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import ScriptNew from './pages/ScriptNew';
import ScriptDetail from './pages/ScriptDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="scripts/new" element={<ScriptNew />} />
          <Route path="scripts/:id/*" element={<ScriptDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
