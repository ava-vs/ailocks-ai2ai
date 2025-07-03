import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, MapPin, Globe, Clock, Edit3, Save, X, Camera, Shield, Bell, Palette, Languages, Trash2, Plus } from 'lucide-react';
import { useUserSession } from '../../hooks/useUserSession';
import { useLocation } from '../../hooks/useLocation';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  country: string;
  city: string;
  timezone: string;
  languages: string[];
  bio?: string;
  skills?: string[];
  interests?: string[];
  joinedAt: string;
  lastActive: string;
  preferences: {
    theme: 'dark' | 'light' | 'auto';
    notifications: boolean;
    emailUpdates: boolean;
    publicProfile: boolean;
  };
}

export default function ProfilePage() {
  const { currentUser, isAuthenticated, isLoading } = useUserSession();
  const location = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'security'>('profile');

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      loadProfile();
    }
  }, [currentUser, isLoading, isAuthenticated]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      // Create profile from current user data with fallbacks
      const userProfile: UserProfile = {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=3b82f6&color=ffffff&size=200`,
        country: currentUser.country || 'Unknown',
        city: currentUser.city || 'Unknown',
        timezone: 'UTC', // Default timezone
        languages: ['en'], // Default language
        bio: `Hello! I'm ${currentUser.name} and I'm excited to collaborate on interesting projects.`,
        skills: ['Collaboration', 'Communication'], // Default skills
        interests: ['Technology', 'Innovation', 'Collaboration'], // Default interests
        joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago as fallback
        lastActive: new Date().toISOString(),
        preferences: {
          theme: 'dark',
          notifications: true,
          emailUpdates: true,
          publicProfile: true
        }
      };
      setProfile(userProfile);
      setEditedProfile(userProfile);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editedProfile) return;
    
    try {
      // Here you would save to the backend
      setProfile(editedProfile);
      setEditing(false);
      
      // Show success message
      console.log('Profile updated successfully');
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setEditing(false);
  };

  const addSkill = (skill: string) => {
    if (!editedProfile || !skill.trim()) return;
    setEditedProfile({
      ...editedProfile,
      skills: [...(editedProfile.skills || []), skill.trim()]
    });
  };

  const removeSkill = (skillToRemove: string) => {
    if (!editedProfile) return;
    setEditedProfile({
      ...editedProfile,
      skills: editedProfile.skills?.filter(skill => skill !== skillToRemove) || []
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 30) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Show auth required message
  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Authentication Required</h2>
          <p className="text-white/60 mb-6">Please sign in to view your profile.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => window.location.href = '/'}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white/60 hover:text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Profile</h1>
            <p className="text-white/60">Manage your account and preferences</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {editing ? (
            <>
              <button
                onClick={handleCancel}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {[
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'preferences', label: 'Preferences', icon: Palette },
          { id: 'security', label: 'Security', icon: Shield }
        ].map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-6 py-4 transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-400'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'profile' && (
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Profile Header */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-start space-x-6">
                <div className="relative">
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white/10"
                  />
                  {editing && (
                    <button className="absolute bottom-0 right-0 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors">
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="flex-1">
                  {editing ? (
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={editedProfile?.name || ''}
                        onChange={(e) => setEditedProfile(prev => prev ? {...prev, name: e.target.value} : null)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
                        placeholder="Full name"
                      />
                      <input
                        type="email"
                        value={editedProfile?.email || ''}
                        onChange={(e) => setEditedProfile(prev => prev ? {...prev, email: e.target.value} : null)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
                        placeholder="Email address"
                      />
                      <textarea
                        value={editedProfile?.bio || ''}
                        onChange={(e) => setEditedProfile(prev => prev ? {...prev, bio: e.target.value} : null)}
                        rows={3}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 resize-none"
                        placeholder="Tell us about yourself..."
                      />
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2">{profile.name}</h2>
                      <p className="text-white/60 mb-4">{profile.email}</p>
                      {profile.bio && (
                        <p className="text-white/80 leading-relaxed">{profile.bio}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-6 mt-6 pt-6 border-t border-white/10">
                <div className="flex items-center space-x-2 text-white/60">
                  <MapPin className="w-4 h-4" />
                  <span>{profile.city}, {profile.country}</span>
                </div>
                <div className="flex items-center space-x-2 text-white/60">
                  <Clock className="w-4 h-4" />
                  <span>{profile.timezone}</span>
                </div>
                <div className="flex items-center space-x-2 text-white/60">
                  <Globe className="w-4 h-4" />
                  <span>{profile.languages.join(', ')}</span>
                </div>
              </div>
            </div>

            {/* Skills */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Skills</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {(editing ? editedProfile?.skills : profile.skills)?.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center space-x-2 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/30"
                  >
                    <span>{skill}</span>
                    {editing && (
                      <button
                        onClick={() => removeSkill(skill)}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              
              {editing && (
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Add a skill..."
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addSkill(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Interests */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {profile.interests?.map((interest) => (
                  <span
                    key={interest}
                    className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-lg border border-purple-500/30"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Activity</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-white/60 text-sm">Member since</p>
                  <p className="text-white font-medium">{new Date(profile.joinedAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Last active</p>
                  <p className="text-white font-medium">{formatTimeAgo(profile.lastActive)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Appearance</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-white/80 text-sm mb-2">Theme</label>
                  <select
                    value={profile.preferences.theme}
                    onChange={(e) => setProfile(prev => prev ? {
                      ...prev,
                      preferences: { ...prev.preferences, theme: e.target.value as any }
                    } : null)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Notifications</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Push Notifications</p>
                    <p className="text-white/60 text-sm">Receive notifications about new opportunities</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.preferences.notifications}
                    onChange={(e) => setProfile(prev => prev ? {
                      ...prev,
                      preferences: { ...prev.preferences, notifications: e.target.checked }
                    } : null)}
                    className="w-4 h-4 text-blue-500 bg-transparent border-white/30 rounded focus:ring-blue-500 focus:ring-2"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Email Updates</p>
                    <p className="text-white/60 text-sm">Receive weekly summaries and updates</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.preferences.emailUpdates}
                    onChange={(e) => setProfile(prev => prev ? {
                      ...prev,
                      preferences: { ...prev.preferences, emailUpdates: e.target.checked }
                    } : null)}
                    className="w-4 h-4 text-blue-500 bg-transparent border-white/30 rounded focus:ring-blue-500 focus:ring-2"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Privacy</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Public Profile</p>
                    <p className="text-white/60 text-sm">Make your profile visible to other users</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.preferences.publicProfile}
                    onChange={(e) => setProfile(prev => prev ? {
                      ...prev,
                      preferences: { ...prev.preferences, publicProfile: e.target.checked }
                    } : null)}
                    className="w-4 h-4 text-blue-500 bg-transparent border-white/30 rounded focus:ring-blue-500 focus:ring-2"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Account Security</h3>
              <div className="space-y-4">
                <button className="w-full text-left p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Change Password</p>
                      <p className="text-white/60 text-sm">Update your account password</p>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-white/40 rotate-180" />
                  </div>
                </button>
                
                <button className="w-full text-left p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Two-Factor Authentication</p>
                      <p className="text-white/60 text-sm">Add an extra layer of security</p>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-white/40 rotate-180" />
                  </div>
                </button>
              </div>
            </div>



            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
              <div className="space-y-4">
                <button className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors">
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Account</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}