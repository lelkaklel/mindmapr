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
      <header className="app-header">
        <h1>MindMapr - Редактор диаграмм связей</h1>
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