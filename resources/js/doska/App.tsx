import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { WorkspacesPage } from './pages/WorkspacesPage';
import { BoardsPage } from './pages/BoardsPage';
import { BoardViewPage } from './pages/BoardViewPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/workspaces" replace />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="workspaces" element={<WorkspacesPage />} />
          <Route path="workspaces/:workspaceId/boards" element={<BoardsPage />} />
          <Route path="workspaces/:workspaceId/boards/:boardId" element={<BoardViewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

