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
  role: "user" | "admin" | "superadmin";
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
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/users`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.data || []);
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
    if (currentUser?.role === "superadmin") {
      fetchUsers();
    }
  }, [currentUser]);

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

  // Add/promote admin
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/users/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, email }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(`Successfully added/promoted ${email} to Admin`);
        setName("");
        setEmail("");
        fetchUsers();
      } else {
        setError(data.message || "Failed to add admin");
      }
    } catch (err) {
      console.error("Error adding admin:", err);
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

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
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/users/admins/${id}`, {
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

  // Format date safely
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  // 1. Auth Loading State
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-white">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <p className="text-zinc-400 font-medium">Verifying authorization permissions...</p>
      </div>
    );
  }

  // 2. Access Denied State (Not superadmin)
  if (!currentUser || currentUser.role !== "superadmin") {
    return (
      <div className="relative flex items-center justify-center min-h-[80vh] px-4">
        {/* Glow rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/10 rounded-full blur-[80px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full backdrop-blur-xl bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-8 shadow-2xl text-center z-10"
        >
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mb-3">
            Access Denied
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            This module is restricted to <strong>Super Administrator</strong> accounts only. 
            You do not have the required permissions to view or manage user accounts.
          </p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all border border-zinc-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </motion.div>
      </div>
    );
  }

  // 3. User Management Screen (Superadmin)
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Background glow effects */}
      <div className="absolute top-10 left-10 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-500" />
            Admin & User Management
          </h1>
          <p className="text-zinc-400 mt-1 text-sm md:text-base">
            Create system administrators, manage account roles, and monitor user logins.
          </p>
        </div>
        
        <button 
          onClick={fetchUsers}
          disabled={loadingUsers}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 disabled:opacity-50 text-zinc-300 font-semibold text-xs rounded-xl transition-all"
        >
          {loadingUsers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Refresh Users
        </button>
      </div>

      {/* Notification Toast Banners */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="p-4 bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-2xl flex items-start gap-3 text-red-400 text-xs font-semibold shadow-2xl shadow-red-500/5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="p-4 bg-green-500/10 border border-green-500/20 backdrop-blur-md rounded-2xl flex items-start gap-3 text-green-400 text-xs font-semibold shadow-2xl shadow-green-500/5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{success}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* Invite Admin Column */}
        <div className="lg:col-span-1">
          <div className="backdrop-blur-xl bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl sticky top-24">
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              Add / Promote Admin
            </h2>
            <p className="text-zinc-500 text-xs mb-6">
              Invite a new admin or promote an existing user.
            </p>

            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">
                  Full Name (Optional)
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                    <UserIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="E.g. Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/40 border border-zinc-800/80 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-zinc-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">
                  Email Address
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="E.g. admin@onemelody.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/40 border border-zinc-800/80 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-zinc-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-6"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Save Administrator
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Users List Column */}
        <div className="lg:col-span-2">
          <div className="backdrop-blur-xl bg-zinc-900/60 border border-zinc-800/80 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800/80">
              <h2 className="text-lg font-bold text-white">Registered Accounts</h2>
              <p className="text-zinc-500 text-xs mt-1">
                A total of {users.length} accounts found on the system.
              </p>
            </div>

            {loadingUsers ? (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="text-sm font-medium">Fetching accounts...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center text-zinc-500">
                No users found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/80 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Joined Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {users.map((account) => {
                      const isSelf = account.id === currentUser.id;
                      const isSuper = account.role === "superadmin";

                      return (
                        <tr key={account.id} className="hover:bg-zinc-800/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {/* Avatar bubble */}
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                                isSuper 
                                  ? "bg-gradient-to-tr from-amber-400 to-orange-500 text-zinc-950" 
                                  : account.role === "admin"
                                  ? "bg-gradient-to-tr from-indigo-500 to-purple-500 text-white"
                                  : "bg-zinc-800 text-zinc-300"
                              }`}>
                                {account.name ? account.name.charAt(0) : account.email.charAt(0)}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold text-white truncate">
                                  {account.name || "Unnamed User"}
                                  {isSelf && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[9px] font-bold rounded-md uppercase tracking-wider">
                                      You
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs text-zinc-500 truncate">{account.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {account.role === "superadmin" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-400/10 border border-amber-400/20 text-amber-400 shadow-sm shadow-amber-400/5">
                                Super Admin
                              </span>
                            ) : account.role === "admin" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-zinc-800 border border-zinc-700 text-zinc-400">
                                User
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-zinc-400">
                            {formatDate(account.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {!isSuper && !isSelf ? (
                              <button
                                onClick={() => handleDeleteUser(account.id, account.email)}
                                disabled={deletingId === account.id}
                                className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
                                title="Remove User"
                              >
                                {deletingId === account.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <span className="text-zinc-600 text-xs font-medium italic select-none">
                                Protected
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
