'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
const logo = '/assets/logo.jpg';
import styles from './register.module.css';

export default function Register() {
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    username: '',                                    
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
  });
                         
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  // Exactement comme votre ancien code qui fonctionnait
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await axios.get(`${apiURL}/admin/roles`);
        const fetchedRoles = response.data;
        setRoles(fetchedRoles);
        // Sélectionner automatiquement le premier rôle
        if (fetchedRoles.length > 0) {
          setForm((prev) => ({ ...prev, role: fetchedRoles[0].name }));
        }
      } catch (error) {
        console.error('❌ Failed to fetch roles:', error);
      }
    };
    fetchRoles();
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (form.password !== form.confirmPassword) {
      alert('Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      setIsLoading(true);
      await axios.post(`${apiURL}/auth/register`, {
        email: form.email,
        password: form.password,
        role: form.role,
        nom: form.nom,
        prenom: form.prenom,
        username: form.username,
      });
      alert('✅ Compte créé avec succès !');
      
      // Réinitialiser le formulaire
      setForm({
        nom: '',
        prenom: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: roles.length > 0 ? roles[0].name : '',
      });
    } catch (error: any) {
      alert(error?.response?.data?.detail || '❌ Erreur lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* SECTION GAUCHE */}
      <div className={styles.leftSection}>
        <div className={styles.logoContainer}>
          <Image src={logo} alt="ANAM Logo" className={styles.logo} width={256} height={256} />
        </div>
        <h1 className={styles.title}>
          AGENCE NATIONALE DES <br />
          ACTIVITÉS MINIÈRES
        </h1>
        <p className={styles.subtitle}>Rejoignez la plateforme SIGAM</p>
      </div>

      {/* SECTION DROITE */}
      <div className={styles.rightSection}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2>Créer un compte</h2>
            <p>Remplissez le formulaire pour vous inscrire</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.grid2}>
              <div className={styles.inputGroup}>
                <label htmlFor="prenom">Prénom *</label>
                <input
                  id="prenom"
                  type="text"
                  value={form.prenom}
                  onChange={e => handleChange('prenom', e.target.value)}
                  placeholder="Prénom"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="nom">Nom *</label>
                <input
                  id="nom"
                  type="text"
                  value={form.nom}
                  onChange={e => handleChange('nom', e.target.value)}
                  placeholder="Nom"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="username">Nom d'utilisateur *</label>
              <input
                id="username"
                type="text"
                value={form.username}
                onChange={e => handleChange('username', e.target.value)}
                placeholder="Nom d'utilisateur"
                disabled={isLoading}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                placeholder="email@exemple.com"
                disabled={isLoading}
                required
              />
            </div>

            {/* EXACTEMENT COMME VOTRE ANCIEN CODE */}
            <div className={styles.inputGroup}>
              <label htmlFor="role">Type de compte *</label>
              <select
                id="role"
                value={form.role}
                onChange={e => handleChange('role', e.target.value)}
                disabled={isLoading}
                required
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password">Mot de passe *</label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={e => handleChange('password', e.target.value)}
                placeholder="Au moins 6 caractères"
                disabled={isLoading}
                minLength={6}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword">Confirmer le mot de passe *</label>
              <input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={e => handleChange('confirmPassword', e.target.value)}
                placeholder="Retapez votre mot de passe"
                disabled={isLoading}
                required
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={isLoading}>
              {isLoading ? 'Inscription...' : 'Créer mon compte'}
            </button>

            <p className={styles.loginLink}>
              Déjà un compte ? <Link href="/">Se connecter</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}