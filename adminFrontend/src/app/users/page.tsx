"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { adminFetch } from "@/lib/adminFetch";
import { 
  Shield, 
  Plus, 
  Trash2, 
  UserPlus, 
  ShieldAlert, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  Mail, 
  User as UserIcon,
  ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface User {
  id: string;
  email: string;
  name: string | null;
  role?: string;
  createdAt?: string;
}

export default function UsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await adminFetch("/admin/account?page=0&size=100");
      const data = await res.json();
      if (res.ok) {
        setUsers(data.content || data.data?.content || data.data || []);
      } else {
        setError(data.message || "Failed to fetch users");
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to connect to the backend server");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Delete/demote user
  const handleDeleteUser = async (id: string, userEmail: string) => {
    if (id === currentUser?.id) {
      setError("You cannot delete your own account");
      return;
    }

    if (!confirm(`Are you sure you want to delete user ${userEmail}? This will completely remove them from the system.`)) {
      return;
    }

    setDeletingId(id);
    setError(null);
    setSuccess(null);

    try {
      const res = await adminFetch(`/admin/account/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSuccess(`User ${userEmail} has been deleted successfully`);
        setUsers(users.filter(u => u.id !== id));
      } else {
        const data = await res.json();
        setError(data.message || "Failed to delete user");
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      setError("An unexpected error occurred");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            User & Admin Management
          </h1>
          <p className="text-zinc-500 mt-1">Manage user permissions and account access across the platform.</p>
        </div>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/30">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            System Accounts ({users.length})
          </h2>
          <button 
            onClick={fetchUsers}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Refresh List
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">User</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Email</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Role</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loadingUsers ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-zinc-500">
                    No accounts registered in system.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                          {(u.name?.[0] || u.email[0]).toUpperCase()}
                        </div>
                        <span className="font-semibold text-zinc-900 dark:text-white text-sm">
                          {u.name || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-sm font-mono">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        u.role === "admin" 
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}>
                        {u.role || "USER"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(u.id, u.email)}
                        disabled={deletingId === u.id}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all disabled:opacity-50"
                        title="Delete User Account"
                      >
                        {deletingId === u.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
