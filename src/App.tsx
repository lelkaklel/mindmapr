import React, { useState, useEffect, useRef } from 'react';
import MindMap from './components/MindMap';
import { Node as MindMapNode, MindMapData } from './types/MindMap';
import './App.css';

const initialData: MindMapData = {
  root: {
    id: '1',
    text: 'Главная идея',
    children: [
      {
        id: '2',
        text: 'Подтема 1',
        children: []
      },
      {
        id: '3',
        text: 'Подтема 2',
        children: []
      }
    ]
  }
};

const App: React.FC = () => {
  const [mindMapData, setMindMapData] = useState<MindMapData>(() => {
    const savedData = localStorage.getItem('mindMapData');
    return savedData ? JSON.parse(savedData) : initialData;
  });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  
  // Создаем ref для доступа к функциям экспорта в MindMap
  const mindMapExportRef = useRef<{
    exportAsPDF: () => Promise<void>;
    exportAsPNG: () => Promise<void>;
    exportAsJPEG: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem('mindMapData', JSON.stringify(mindMapData));
  }, [mindMapData]);
  
  // Обработчик клика вне меню экспорта для его закрытия
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current && 
        exportButtonRef.current && 
        !exportMenuRef.current.contains(event.target as Node) &&
        !exportButtonRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNodeClick = (node: MindMapNode) => {
    console.log('Выбран узел:', node);
  };

  const handleNodeUpdate = (updatedNode: MindMapNode) => {
    const updateNodeInTree = (node: MindMapNode): MindMapNode => {
      if (node.id === updatedNode.id) {
        return updatedNode;
      }
      return {
        ...node,
        children: node.children.map(updateNodeInTree)
      };
    };

    setMindMapData(prevData => ({
      root: updateNodeInTree(prevData.root)
    }));
  };

  const handleNodeDelete = (nodeId: string, parentId: string) => {
    const deleteNodeFromTree = (node: MindMapNode): MindMapNode => {
      if (node.id === parentId) {
        return {
          ...node,
          children: node.children.filter(child => child.id !== nodeId)
        };
      }
      return {
        ...node,
        children: node.children.map(deleteNodeFromTree)
      };
    };

    setMindMapData(prevData => ({
      root: deleteNodeFromTree(prevData.root)
    }));
  };

  // Функция сброса диаграммы до корневого узла
  const handleReset = () => {
    const resetData: MindMapData = {
      root: {
        id: mindMapData.root.id,
        text: initialData.root.text,
        children: []
      }
    };
    setMindMapData(resetData);
  };

  // Экспорт данных в JSON
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(mindMapData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'mindmap.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    setShowExportMenu(false);
  };
  
  // Экспорт в PDF
  const handleExportPDF = async () => {
    if (mindMapExportRef.current) {
      await mindMapExportRef.current.exportAsPDF();
    }
    setShowExportMenu(false);
  };
  
  // Экспорт в PNG
  const handleExportPNG = async () => {
    if (mindMapExportRef.current) {
      await mindMapExportRef.current.exportAsPNG();
    }
    setShowExportMenu(false);
  };
  
  // Экспорт в JPEG
  const handleExportJPEG = async () => {
    if (mindMapExportRef.current) {
      await mindMapExportRef.current.exportAsJPEG();
    }
    setShowExportMenu(false);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string);
          setMindMapData(importedData);
        } catch (error) {
          console.error('Ошибка при импорте файла:', error);
          alert('Ошибка при импорте файла. Проверьте формат файла.');
        }
      };
      reader.readAsText(file);
    }
  };

  // Переключаем отображение меню экспорта
  const toggleExportMenu = () => {
    setShowExportMenu(!showExportMenu);
  };

  return (
    <div className="app">
      {/* GitHub уголок */}
      <a href="https://github.com/lelkaklel/mindmapr" className="github-corner" aria-label="Просмотреть исходный код на GitHub">
        <svg width="60" height="60" viewBox="0 0 250 250" style={{ fill: '#151513', color: '#fff', position: 'absolute', bottom: 0, border: 0, right: 0, transform: 'scale(1, -1)' }} aria-hidden="true">
          <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"></path>
          <path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" fill="currentColor" style={{ transformOrigin: '130px 106px' }} className="octo-arm"></path>
          <path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" fill="currentColor" className="octo-body"></path>
        </svg>
      </a>
      
      <header className="app-header">
        <h1><span>MindMapr</span></h1>
        <div className="app-controls">
          <div className="export-menu-container">
            <button 
              onClick={toggleExportMenu} 
              ref={exportButtonRef}
              className="export-button"
            >
              Экспорт
            </button>
            {showExportMenu && (
              <div className="export-menu" ref={exportMenuRef}>
                <button onClick={handleExportJSON}>JSON</button>
                <button onClick={handleExportPDF}>PDF</button>
                <button onClick={handleExportPNG}>PNG</button>
                <button onClick={handleExportJPEG}>JPEG</button>
              </div>
            )}
          </div>
          <label className="import-button">
            Импорт
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={handleReset} className="reset-button">
            Очистить
          </button>
        </div>
      </header>
      <main className="app-main">
        <div className="mind-map-container">
          <MindMap 
            data={mindMapData} 
            onNodeClick={handleNodeClick}
            onNodeUpdate={handleNodeUpdate}
            onNodeDelete={handleNodeDelete}
            exportRef={mindMapExportRef}
          />
        </div>
      </main>
    </div>
  );
};

export default App; 