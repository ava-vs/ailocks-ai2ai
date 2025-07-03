import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Calendar, Users, Star } from 'lucide-react';
import type { ResearchReport, ResearchSource } from '@/lib/deep-research-service';

interface DeepResearchResultProps {
  report: ResearchReport;
  className?: string;
}

function getSourceTypeIcon(sourceType: string) {
  switch (sourceType) {
    case 'academic':
      return '🎓';
    case 'web':
      return '🌐';
    case 'patent':
      return '📋';
    case 'news':
      return '📰';
    default:
      return '📄';
  }
}

export default function DeepResearchResult({ report, className = '' }: DeepResearchResultProps) {
  const [expandedSections, setExpandedSections] = useState({
    insights: true,
    recommendations: true,
    sources: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-50';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };



  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            🔍 Результаты глубокого исследования
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            <strong>Запрос:</strong> {report.query}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(report.confidence)}`}>
          {report.confidence}% достоверность
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-900 mb-2">Краткое резюме</h4>
        <p className="text-gray-700 leading-relaxed">{report.summary}</p>
      </div>

      {/* Key Insights */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('insights')}
          className="flex items-center justify-between w-full text-md font-medium text-gray-900 mb-3 hover:text-gray-700"
        >
          <span>Ключевые инсайты ({report.keyInsights.length})</span>
          {expandedSections.insights ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        
        {expandedSections.insights && (
          <ul className="space-y-2">
            {report.keyInsights.map((insight, index) => (
              <li key={index} className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                  {index + 1}
                </span>
                <span className="text-gray-700">{insight}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recommendations */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('recommendations')}
          className="flex items-center justify-between w-full text-md font-medium text-gray-900 mb-3 hover:text-gray-700"
        >
          <span>Рекомендации ({report.recommendations.length})</span>
          {expandedSections.recommendations ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        
        {expandedSections.recommendations && (
          <ul className="space-y-2">
            {report.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                  {index + 1}
                </span>
                <span className="text-gray-700">{rec}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sources */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection('sources')}
          className="flex items-center justify-between w-full text-md font-medium text-gray-900 mb-3 hover:text-gray-700"
        >
          <span>Источники ({report.sources.length})</span>
          {expandedSections.sources ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        
        {expandedSections.sources && (
          <div className="space-y-3">
            {report.sources.map((source, index) => (
              <SourceCard key={index} source={source} index={index + 1} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 text-sm text-gray-500">
        <span>
          Найдено {report.sources.length} источников
        </span>
        <span>
          {new Date(report.timestamp).toLocaleString('ru-RU')}
        </span>
      </div>
    </div>
  );
}

interface SourceCardProps {
  source: ResearchSource;
  index: number;
}

function SourceCard({ source, index }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start space-x-3 flex-1">
          <span className="text-lg">{getSourceTypeIcon(source.sourceType)}</span>
          <div className="flex-1 min-w-0">
            <h5 className="font-medium text-gray-900 leading-tight">
              <a 
                href={source.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors"
              >
                {source.title}
              </a>
            </h5>
            
            {source.authors && source.authors.length > 0 && (
              <div className="flex items-center mt-1 text-sm text-gray-600">
                <Users className="w-3 h-3 mr-1" />
                <span>{source.authors.join(', ')}</span>
              </div>
            )}
            
            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
              {source.year && (
                <div className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{source.year}</span>
                </div>
              )}
              
              {source.citationCount !== undefined && (
                <div className="flex items-center">
                  <Star className="w-3 h-3 mr-1" />
                  <span>{source.citationCount} цитирований</span>
                </div>
              )}
              
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRelevanceColor(source.relevanceScore)}`}>
                {Math.round(source.relevanceScore * 100)}% релевантность
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Открыть источник"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title={expanded ? "Свернуть" : "Развернуть"}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      
      {expanded && source.snippet && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-sm text-gray-700 leading-relaxed">
            {source.snippet}
          </p>
          {source.doi && (
            <p className="text-xs text-gray-500 mt-2">
              DOI: {source.doi}
            </p>
          )}
        </div>
      )}
    </div>
  );
} 