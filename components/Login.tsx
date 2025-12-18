
import React, { useState } from 'react';
import { authenticate } from '../services/storageService';
import { User } from '../types';
import { LogIn, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [reg, setReg] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const user = await authenticate(reg, pass);
    if (user) {
      onLogin(user);
    } else {
      setError('Matrícula ou senha inválidos, ou erro de conexão.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-ciclus-600 rounded-xl flex items-center justify-center text-white font-bold text-3xl shadow-lg mx-auto mb-4">C</div>
          <h1 className="text-2xl font-bold text-gray-800">Ciclus Digital RD</h1>
          <p className="text-gray-500">Entre com suas credenciais</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula</label>
            <input
              type="text"
              value={reg}
              onChange={e => setReg(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ciclus-500 focus:border-ciclus-500"
              placeholder="Digite sua matrícula"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ciclus-500 focus:border-ciclus-500"
              placeholder="Digite sua senha"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ciclus-600 text-white py-3 rounded-lg font-bold hover:bg-ciclus-700 transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
