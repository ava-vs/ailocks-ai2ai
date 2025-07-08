import React from 'react';
import { X, Star, Trophy, TrendingUp, CheckCircle2 } from 'lucide-react';
import type { FullAilockProfile } from '@/lib/ailock/shared';
import { getLevelInfo } from '@/lib/ailock/shared';
import { useDailyTasks } from '@/hooks/useDailyTasks';

interface AilockQuickStatusProps {
  isOpen: boolean;
  onClose: () => void;
  profile: FullAilockProfile | null;
  onOpenFullProfile: () => void;
}

export default function AilockQuickStatus({ isOpen, onClose, profile, onOpenFullProfile }: AilockQuickStatusProps) {
  if (!isOpen || !profile) return null;

  const levelInfo = getLevelInfo(profile.xp);
  const { tasks: dailyTasks, loading: tasksLoading } = useDailyTasks();

  const getAvatarGradient = () => {
    if (profile.level >= 15) return 'from-purple-400 via-pink-400 to-yellow-400';
    if (profile.level >= 10) return 'from-blue-400 via-purple-400 to-pink-400';
    if (profile.level >= 5) return 'from-green-400 via-blue-400 to-purple-400';
    return 'from-cyan-400 via-blue-400 to-indigo-400';
  };

  const completedTasks = dailyTasks.filter(task => task.status === 'completed').length;

  return (
    <>
      {/* Backdrop for closing when clicking outside */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      {/* Dropdown positioned below the header button */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-[320px] md:w-[480px] max-w-[90vw]">
        <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getAvatarGradient()} p-0.5`}>
                <div className="w-full h-full rounded-xl bg-slate-800/90 flex items-center justify-center">
                  <img 
                    src="/images/ailock-avatar.png" 
                    alt="Ailock Avatar" 
                    className="w-8 h-8"
                    style={{border: 'none', outline: 'none'}}
                  />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{profile.name}</h3>
                <p className="text-sm text-white/60">Ailock Assistant</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* Quick Status */}
          <div className="text-sm text-white/80 mb-4">
            Quick Status
          </div>

          {/* Level Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-medium text-white">Level Progress</span>
              <span className="text-sm text-white/60">Level {levelInfo.level}</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-white/50">{profile.xp} XP</span>
              <div className="flex-1 bg-white/10 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                  style={{ width: `${levelInfo.progressPercentage}%` }}
                />
              </div>
              <span className="text-sm text-white/50">{levelInfo.progressXp}/{levelInfo.xpNeededForNextLevel} XP</span>
            </div>
            <p className="text-sm text-white/40 mt-2">
              {levelInfo.xpToNextLevel} XP to next level
            </p>
          </div>

          {/* Today's Task */}
          <div className="mb-6">
            <h4 className="text-base font-medium text-white mb-4">Today's Tasks</h4>
            {tasksLoading ? (
              <div className="text-center text-white/60">Loading tasks...</div>
            ) : (
              <div className="space-y-3">
                {dailyTasks.length > 0 ? dailyTasks.slice(0, 3).map((task) => {
                  const isCompleted = task.status === 'completed';
                  const progress = task.definition ? (task.progressCount / task.definition.triggerCountGoal) * 100 : 0;
                  return (
                    <div key={task.id} className="flex items-center space-x-3 group">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                        isCompleted
                          ? 'bg-green-500' 
                          : 'bg-white/10 ring-2 ring-white/20'
                      }`}>
                        {isCompleted && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                      <div className="flex-1">
                        <span className={`text-sm ${
                          isCompleted ? 'text-white/60 line-through' : 'text-white/80'
                        }`}>
                          {task.definition?.name || task.taskId}
                        </span>
                        {!isCompleted && task.definition && task.definition.triggerCountGoal > 1 && (
                           <div className="w-full bg-white/10 rounded-full h-1 mt-1 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-green-400 font-medium">
                        {task.definition?.xpReward || ''} XP
                      </span>
                    </div>
                  );
                }) : <p className="text-sm text-white/60 text-center">No tasks for today. Check back tomorrow!</p>}
              </div>
            )}
            {dailyTasks.length > 0 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-white/60">Progress</span>
                <span className="text-blue-400">{completedTasks}/{dailyTasks.length} completed</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Close
            </button>
            <button 
              onClick={() => {
                onClose();
                onOpenFullProfile();
              }}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl font-medium"
            >
              Full Profile
            </button>
          </div>
        </div>
      </div>
    </>
  );
}