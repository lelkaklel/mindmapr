import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Node, MindMapData } from '../types/MindMap';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

interface MindMapProps {
  data: MindMapData;
  onNodeClick?: (node: Node) => void;
  onNodeUpdate?: (updatedNode: Node) => void;
  onNodeDelete?: (nodeId: string, parentId: string) => void;
  exportRef?: React.MutableRefObject<{
    exportAsPDF: () => Promise<void>;
    exportAsPNG: () => Promise<void>;
    exportAsJPEG: () => Promise<void>;
  } | null>;
}

// Минимальные расстояния между узлами для предотвращения перекрытий
const NODE_HORIZONTAL_SPACING = 200; // Горизонтальный отступ между уровнями
const NODE_VERTICAL_SPACING = 80;   // Минимальный вертикальный отступ между узлами одного уровня

// Интерфейс для стилей узлов
interface NodeStyle {
  fill: string;
  stroke: string;
  textColor: string;
  fontSize: number;
  fontWeight: string | number;
  padding: number;
  height: number;
  strokeWidth: number;
}

// Цвета и стили для разных рангов узлов
const NODE_STYLES: Record<string, NodeStyle> = {
  '0': { // Корневой узел
    fill: '#ff9800',
    stroke: '#e65100',
    textColor: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    padding: 15,
    height: 40,
    strokeWidth: 3
  },
  '1': { // Узлы 1-го ранга
    fill: '#2196F3',
    stroke: '#0D47A1',
    textColor: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    padding: 10,
    height: 35,
    strokeWidth: 2.5
  },
  '2': { // Узлы 2-го ранга
    fill: '#4CAF50',
    stroke: '#1B5E20',
    textColor: '#fff',
    fontSize: 13,
    fontWeight: 600,
    padding: 8,
    height: 30,
    strokeWidth: 2
  },
  'default': { // Узлы 3-го и более рангов
    fill: '#f0f0f0',
    stroke: '#999',
    textColor: '#333',
    fontSize: 12,
    fontWeight: 'normal',
    padding: 6,
    height: 28,
    strokeWidth: 1.5
  }
};

interface EditingNodeInfo {
  node: Node;
  text: string;
  position: { x: number; y: number };
  parentId?: string;
  depth: number;
}

const MindMap: React.FC<MindMapProps> = ({ data, onNodeClick, onNodeUpdate, onNodeDelete, exportRef }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingInfo, setEditingInfo] = useState<EditingNodeInfo | null>(null);
  const [scale, setScale] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Функция для обновления размеров
  const updateDimensions = () => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
  };

  // Функции экспорта

  // Экспорт в PDF
  const exportAsPDF = async () => {
    if (!svgRef.current || !containerRef.current) return;
    
    // Закрываем форму редактирования, если она открыта
    setEditingInfo(null);
    
    // Задержка для обеспечения закрытия формы перед экспортом
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Получаем текущую трансформацию
      const svg = d3.select(svgRef.current);
      const g = svg.select('g');
      const currentTransform = d3.zoomTransform(svg.node() as any);
      
      // Сохраняем оригинальные размеры SVG
      const containerRect = containerRef.current.getBoundingClientRect();
      const originalWidth = containerRect.width;
      const originalHeight = containerRect.height;
      
      // Создаем временный div для создания canvas
      const tempDiv = document.createElement('div');
      document.body.appendChild(tempDiv);
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '1200px';
      tempDiv.style.height = '842px';
      
      // Создаем новый SVG для экспорта
      const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      exportSvg.setAttribute('width', '1200');
      exportSvg.setAttribute('height', '842');
      exportSvg.setAttribute('viewBox', '0 0 1200 842');
      
      // Копируем содержимое исходного SVG
      const exportG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const originalG = g.node() as SVGGElement;
      
      if (originalG) {
        // Копируем все дочерние элементы
        Array.from(originalG.childNodes).forEach((childNode: ChildNode) => {
          exportG.appendChild(childNode.cloneNode(true));
        });
        
        // Вычисляем масштаб для подгонки всей диаграммы на страницу с отступами
        const padding = 40; // отступ от краев
        const boundingBox = originalG.getBBox();
        
        const scaleX = (1200 - padding * 2) / boundingBox.width;
        const scaleY = (842 - padding * 2) / boundingBox.height;
        const scale = Math.min(scaleX, scaleY, 2); // Ограничиваем максимальный масштаб для качества
        
        // Центрируем диаграмму с использованием вычисленного масштаба
        const centerX = 1200 / 2;
        const centerY = 842 / 2;
        const transformValue = `translate(${centerX}, ${centerY}) scale(${scale}) translate(${-boundingBox.x - boundingBox.width/2}, ${-boundingBox.y - boundingBox.height/2})`;
        
        exportG.setAttribute('transform', transformValue);
        exportSvg.appendChild(exportG);
        tempDiv.appendChild(exportSvg);
      }
      
      // Конвертируем SVG в Canvas с помощью html2canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2, // Увеличиваем масштаб для лучшего качества
        backgroundColor: '#ffffff',
        logging: false
      });
      
      // Удаляем временный div
      document.body.removeChild(tempDiv);
      
      // Создаем PDF с помощью jsPDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Добавляем изображение в PDF
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210); // A4 размер в ландшафтной ориентации
      
      // Сохраняем PDF
      pdf.save('mind_map.pdf');
      
    } catch (error) {
      console.error('Ошибка при экспорте в PDF:', error);
    }
  };

  // Экспорт в PNG
  const exportAsPNG = async () => {
    if (!svgRef.current || !containerRef.current) return;
    
    // Закрываем форму редактирования, если она открыта
    setEditingInfo(null);
    
    // Задержка для обеспечения закрытия формы перед экспортом
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Получаем текущую трансформацию
      const svg = d3.select(svgRef.current);
      const g = svg.select('g');
      const currentTransform = d3.zoomTransform(svg.node() as any);
      
      // Получаем размеры контейнера
      const containerRect = containerRef.current.getBoundingClientRect();
      
      // Создаем временный div для создания canvas
      const tempDiv = document.createElement('div');
      document.body.appendChild(tempDiv);
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '1500px';
      tempDiv.style.height = '1000px';
      
      // Создаем новый SVG для экспорта
      const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      exportSvg.setAttribute('width', '1500');
      exportSvg.setAttribute('height', '1000');
      exportSvg.setAttribute('viewBox', '0 0 1500 1000');
      
      // Копируем содержимое исходного SVG
      const exportG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const originalG = g.node() as SVGGElement;
      
      if (originalG) {
        // Копируем все дочерние элементы
        Array.from(originalG.childNodes).forEach((childNode: ChildNode) => {
          exportG.appendChild(childNode.cloneNode(true));
        });
        
        // Вычисляем масштаб для подгонки всей диаграммы на страницу с отступами
        const padding = 50; // отступ от краев
        const boundingBox = originalG.getBBox();
        
        const scaleX = (1500 - padding * 2) / boundingBox.width;
        const scaleY = (1000 - padding * 2) / boundingBox.height;
        const scale = Math.min(scaleX, scaleY, 2); // Ограничиваем максимальный масштаб для качества
        
        // Центрируем диаграмму с использованием вычисленного масштаба
        const centerX = 1500 / 2;
        const centerY = 1000 / 2;
        const transformValue = `translate(${centerX}, ${centerY}) scale(${scale}) translate(${-boundingBox.x - boundingBox.width/2}, ${-boundingBox.y - boundingBox.height/2})`;
        
        exportG.setAttribute('transform', transformValue);
        exportSvg.appendChild(exportG);
        tempDiv.appendChild(exportSvg);
      }
      
      // Конвертируем SVG в Canvas с помощью html2canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2, // Увеличиваем масштаб для лучшего качества
        backgroundColor: '#ffffff',
        logging: false
      });
      
      // Удаляем временный div
      document.body.removeChild(tempDiv);
      
      // Конвертируем Canvas в PNG и сохраняем
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, 'mind_map.png');
        }
      }, 'image/png');
    } catch (error) {
      console.error('Ошибка при экспорте в PNG:', error);
    }
  };

  // Экспорт в JPEG
  const exportAsJPEG = async () => {
    if (!svgRef.current || !containerRef.current) return;
    
    // Закрываем форму редактирования, если она открыта
    setEditingInfo(null);
    
    // Задержка для обеспечения закрытия формы перед экспортом
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Получаем текущую трансформацию
      const svg = d3.select(svgRef.current);
      const g = svg.select('g');
      const currentTransform = d3.zoomTransform(svg.node() as any);
      
      // Получаем размеры контейнера
      const containerRect = containerRef.current.getBoundingClientRect();
      
      // Создаем временный div для создания canvas
      const tempDiv = document.createElement('div');
      document.body.appendChild(tempDiv);
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '1500px';
      tempDiv.style.height = '1000px';
      
      // Создаем новый SVG для экспорта
      const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      exportSvg.setAttribute('width', '1500');
      exportSvg.setAttribute('height', '1000');
      exportSvg.setAttribute('viewBox', '0 0 1500 1000');
      
      // Копируем содержимое исходного SVG
      const exportG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const originalG = g.node() as SVGGElement;
      
      if (originalG) {
        // Копируем все дочерние элементы
        Array.from(originalG.childNodes).forEach((childNode: ChildNode) => {
          exportG.appendChild(childNode.cloneNode(true));
        });
        
        // Вычисляем масштаб для подгонки всей диаграммы на страницу с отступами
        const padding = 50; // отступ от краев
        const boundingBox = originalG.getBBox();
        
        const scaleX = (1500 - padding * 2) / boundingBox.width;
        const scaleY = (1000 - padding * 2) / boundingBox.height;
        const scale = Math.min(scaleX, scaleY, 2); // Ограничиваем максимальный масштаб для качества
        
        // Центрируем диаграмму с использованием вычисленного масштаба
        const centerX = 1500 / 2;
        const centerY = 1000 / 2;
        const transformValue = `translate(${centerX}, ${centerY}) scale(${scale}) translate(${-boundingBox.x - boundingBox.width/2}, ${-boundingBox.y - boundingBox.height/2})`;
        
        exportG.setAttribute('transform', transformValue);
        exportSvg.appendChild(exportG);
        tempDiv.appendChild(exportSvg);
      }
      
      // Конвертируем SVG в Canvas с помощью html2canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2, // Увеличиваем масштаб для лучшего качества
        backgroundColor: '#ffffff',
        logging: false
      });
      
      // Удаляем временный div
      document.body.removeChild(tempDiv);
      
      // Конвертируем Canvas в JPEG и сохраняем
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, 'mind_map.jpg');
        }
      }, 'image/jpeg', 0.9); // Качество 0.9
    } catch (error) {
      console.error('Ошибка при экспорте в JPEG:', error);
    }
  };

  // Предоставляем функции экспорта через ref
  useEffect(() => {
    if (exportRef) {
      exportRef.current = {
        exportAsPDF,
        exportAsPNG,
        exportAsJPEG
      };
    }
  }, [exportRef]);

  // Обработчик изменения размера окна
  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Функция для создания радиального макета mind map с предотвращением наложений
  const createMindMapLayout = (root: d3.HierarchyNode<Node>, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;

    // Рассчитываем высоту для каждого узла в зависимости от количества его дочерних элементов
    const calculateNodeHeight = (node: d3.HierarchyNode<Node>): number => {
      if (!node.children || node.children.length === 0) {
        return NODE_VERTICAL_SPACING;
      }
      return Math.max(
        NODE_VERTICAL_SPACING,
        d3.sum(node.children, child => calculateNodeHeight(child))
      );
    };
     
    // Рекурсивно назначаем координаты узлам
    const assignCoordinates = (
      node: d3.HierarchyNode<Node>,
      xPos: number,
      yPos: number,
      isLeft: boolean = false,
      availableHeight: number = height,
      parentYPos: number = centerY,
      currentDepth: number = 0
    ) => {
      // Назначаем текущую позицию
      node.y = xPos;
      node.x = yPos;
      
      if (!node.children || node.children.length === 0) return;
      
      // Сортируем детей, чтобы они размещались сверху вниз
      const sortedChildren = [...node.children].sort((a, b) => {
        const aHeight = calculateNodeHeight(a);
        const bHeight = calculateNodeHeight(b);
        return bHeight - aHeight; // Сортировка по высоте в убывающем порядке
      });
      
      // Рассчитываем общую высоту всех дочерних элементов
      const totalHeight = d3.sum(sortedChildren, child => calculateNodeHeight(child));
      
      // Начальная позиция Y для размещения детей
      let currentY = yPos - totalHeight / 2;
      
      // Для каждого дочернего узла
      sortedChildren.forEach(child => {
        const childHeight = calculateNodeHeight(child);
        // Середина пространства, выделенного для дочернего узла
        const childYPosition = currentY + childHeight / 2;
        
        // Определяем X-позицию для дочернего узла
        const childXPosition = isLeft
          ? xPos - NODE_HORIZONTAL_SPACING
          : xPos + NODE_HORIZONTAL_SPACING;
        
        // Рекурсивно назначаем координаты для дочернего узла
        assignCoordinates(
          child,
          childXPosition,
          childYPosition,
          isLeft,
          childHeight,
          yPos,
          currentDepth + 1
        );
        
        // Обновляем текущую позицию Y для следующего дочернего узла
        currentY += childHeight;
      });
    };

    // Особая обработка для корневого узла
    root.x = centerY;
    root.y = centerX;

    // Разделяем детей корневого узла на левую и правую группы
    if (root.children && root.children.length > 0) {
      const leftCount = Math.ceil(root.children.length / 2);
      const rightCount = root.children.length - leftCount;
      
      const leftChildren = root.children.slice(0, leftCount);
      const rightChildren = root.children.slice(leftCount);
      
      // Вычисляем высоту для левой и правой групп
      const leftHeight = d3.sum(leftChildren, child => calculateNodeHeight(child));
      const rightHeight = d3.sum(rightChildren, child => calculateNodeHeight(child));
      
      // Назначаем координаты для левой группы
      let leftCurrentY = centerY - leftHeight / 2;
      leftChildren.forEach(child => {
        const childHeight = calculateNodeHeight(child);
        const childY = leftCurrentY + childHeight / 2;
        assignCoordinates(
          child,
          centerX - NODE_HORIZONTAL_SPACING,
          childY,
          true,
          childHeight,
          centerY,
          1
        );
        leftCurrentY += childHeight;
      });
      
      // Назначаем координаты для правой группы
      let rightCurrentY = centerY - rightHeight / 2;
      rightChildren.forEach(child => {
        const childHeight = calculateNodeHeight(child);
        const childY = rightCurrentY + childHeight / 2;
        assignCoordinates(
          child,
          centerX + NODE_HORIZONTAL_SPACING,
          childY,
          false,
          childHeight,
          centerY,
          1
        );
        rightCurrentY += childHeight;
      });
    }

    return root;
  };

  // Вспомогательная функция для измерения ширины текста
  const getTextWidth = (text: string, fontSize: number = 14): number => {
    // Приблизительная оценка: каждый символ ~ 0.6 от размера шрифта
    return text.length * fontSize * 0.6 + 10; // 10px - дополнительный отступ
  };

  // Функция для получения стиля узла в зависимости от его глубины
  const getNodeStyle = (depth: number): NodeStyle => {
    return NODE_STYLES[depth.toString()] || NODE_STYLES.default;
  };

  // Обработчик добавления нового узла
  const handleAddNode = () => {
    if (!editingInfo) return;
    
    const newNode: Node = {
      id: Date.now().toString(),
      text: 'Новый узел',
      children: []
    };
    
    editingInfo.node.children.push(newNode);
    
    if (onNodeUpdate) {
      onNodeUpdate(editingInfo.node);
    }
    
    // Закрываем форму после добавления узла
    setEditingInfo(null);
  };

  // Обработчик удаления узла
  const handleDeleteNode = () => {
    if (!editingInfo || editingInfo.depth === 0 || !editingInfo.parentId) return;
    
    if (onNodeDelete) {
      onNodeDelete(editingInfo.node.id, editingInfo.parentId);
      setEditingInfo(null);
    }
  };

  // Обработчик сохранения редактирования
  const handleEditSubmit = () => {
    if (!editingInfo || !onNodeUpdate) return;
    
    const updatedNode = { ...editingInfo.node, text: editingInfo.text };
    
    // Находим и обновляем текст узла напрямую в DOM без перерисовки всей диаграммы
    if (svgRef.current) {
      const nodeElement = d3.select(svgRef.current)
        .select(`g.node[data-id="${updatedNode.id}"]`);
      
      if (!nodeElement.empty()) {
        // Обновляем текст
        nodeElement.select('text').text(updatedNode.text);
        
        // Обновляем прямоугольник, чтобы он соответствовал новому размеру текста
        const nodeStyle = getNodeStyle(editingInfo.depth);
        const textWidth = getTextWidth(updatedNode.text, nodeStyle.fontSize) + nodeStyle.padding * 2;
        
        nodeElement.select('rect')
          .attr('x', -textWidth / 2)
          .attr('width', textWidth);
      }
    }
    
    // Вызываем обработчик для обновления данных
    onNodeUpdate(updatedNode);
    setEditingInfo(null);
  };

  // Основной useEffect для создания диаграммы
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data) return;
    
    const { width, height } = dimensions;
    
    // Сохраняем текущую трансформацию перед очисткой SVG
    let savedTransform: d3.ZoomTransform | null = null;
    if (svgRef.current) {
      try {
        savedTransform = d3.zoomTransform(svgRef.current);
      } catch (e) {
        console.log('Ошибка при получении трансформации:', e);
      }
    }
    
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
    
    svg.selectAll('*').remove();
    
    // Создаем группу для содержимого диаграммы
    const g = svg.append('g');
    
    // Функция масштабирования (zoom)
    const zoom = d3.zoom()
      .scaleExtent([0.1, 3]) // Минимальный и максимальный масштаб
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        // Обновляем текущий масштаб
        setScale(event.transform.k);
      });
    
    // Применяем масштабирование к SVG элементу
    svg.call(zoom as any);

    // Добавляем кнопки управления масштабом
    const zoomControls = svg.append('g')
      .attr('class', 'zoom-controls')
      .attr('transform', `translate(${width - 35}, 20)`);

    zoomControls.append('circle')
      .attr('r', 15)
      .attr('fill', '#fff')
      .attr('stroke', '#ccc')
      .attr('cursor', 'pointer')
      .on('click', () => {
        svg.transition()
          .duration(300)
          .call(zoom.scaleBy as any, 1.2);
      });

    zoomControls.append('text')
      .attr('x', 0)
      .attr('y', 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '20px')
      .style('pointer-events', 'none')
      .text('+');

    zoomControls.append('circle')
      .attr('r', 15)
      .attr('cy', 40)
      .attr('fill', '#fff')
      .attr('stroke', '#ccc')
      .attr('cursor', 'pointer')
      .on('click', () => {
        svg.transition()
          .duration(300)
          .call(zoom.scaleBy as any, 0.8);
      });

    zoomControls.append('text')
      .attr('x', 0)
      .attr('y', 45)
      .attr('text-anchor', 'middle')
      .attr('font-size', '20px')
      .style('pointer-events', 'none')
      .text('−');
      
    // Добавляем кнопку сброса масштаба (центрирование)
    zoomControls.append('circle')
      .attr('r', 15)
      .attr('cy', 80)
      .attr('fill', '#fff')
      .attr('stroke', '#ccc')
      .attr('cursor', 'pointer')
      .on('click', () => {
        // Получаем размеры и расположение диаграммы
        const gElement = g.node() as SVGGElement;
        if (gElement) {
          const boundingBox = gElement.getBBox();
          
          // Вычисляем масштаб для подгонки всей диаграммы на страницу с отступами
          const padding = 40; // отступ от краев
          const scaleX = (width - padding * 2) / boundingBox.width;
          const scaleY = (height - padding * 2) / boundingBox.height;
          const scale = Math.min(scaleX, scaleY, 0.8); // Ограничиваем масштаб для удобства просмотра
          
          // Центрируем диаграмму
          const centerX = width / 2;
          const centerY = height / 2;
          
          // Создаем начальную трансформацию
          const initialTransform = d3.zoomIdentity
            .translate(centerX, centerY)
            .scale(scale)
            .translate(-boundingBox.x - boundingBox.width/2, -boundingBox.y - boundingBox.height/2);
          
          // Применяем трансформацию
          svg.call(zoom.transform as any, initialTransform);
        }
      });

    // Добавляем иконку SQUARE FOUR CORNERS
    zoomControls.append('text')
      .attr('x', 0)
      .attr('y', 85)
      .attr('text-anchor', 'middle')
      .attr('font-size', '18px')
      .style('pointer-events', 'none')
      .text('⛶');

    // Создаем иерархию и назначаем координаты
    const root = d3.hierarchy(data.root);
    createMindMapLayout(root, width, height);

    // Слой для линий (добавляем его первым, чтобы он был под узлами)
    const linksLayer = g.append('g').attr('class', 'links-layer');
    
    // Слой для узлов (добавляем его вторым, чтобы он был над линиями)
    const nodesLayer = g.append('g').attr('class', 'nodes-layer');

    // Функция для определения точки соединения линий с узлами
    const getConnectionPoint = (d: any, isSource: boolean) => {
      const node = isSource ? d.source : d.target;
      const nodeStyle = getNodeStyle(node.depth);
      const isLeft = node.y < width / 2;
      
      // Для всех узлов используем точки соединения с рамкой
      const textWidth = getTextWidth(node.data.text, nodeStyle.fontSize) + nodeStyle.padding * 2;
      const halfWidth = textWidth / 2;
      const halfHeight = nodeStyle.height / 2;
      
      // Точки соединения для рамок
      if (isSource) {
        // Источник линии - соединяем с правильной стороной рамки
        if (d.target.y < node.y) {
          // Цель слева от источника - соединяем с левой стороной
          return { x: node.y - halfWidth, y: node.x };
        } else {
          // Цель справа от источника - соединяем с правой стороной
          return { x: node.y + halfWidth, y: node.x };
        }
      } else {
        // Цель линии - соединяем с правильной стороной рамки
        if (isLeft) {
          // Цель слева - соединяем с правой стороной
          return { x: node.y + halfWidth, y: node.x };
        } else {
          // Цель справа - соединяем с левой стороной
          return { x: node.y - halfWidth, y: node.x };
        }
      }
    };

    // Функция для создания линий между узлами с использованием пользовательского пути
    const generateCustomLink = (d: any) => {
      const source = getConnectionPoint(d, true);
      const target = getConnectionPoint(d, false);
      
      // Используем квадратичную кривую Безье для соединения
      return `M${source.x},${source.y} Q${(source.x + target.x) / 2},${source.y} ${(source.x + target.x) / 2},${(source.y + target.y) / 2} Q${(source.x + target.x) / 2},${target.y} ${target.x},${target.y}`;
    };

    // Добавляем связи между узлами с толщиной в зависимости от глубины
    linksLayer.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d => generateCustomLink(d))
      .style('fill', 'none')
      .style('stroke', (d: any) => {
        // Более тонкие линии для удаленных узлов
        const depth = d.target.depth;
        return depth === 1 ? '#666' : '#999';
      })
      .style('stroke-width', (d: any) => {
        // Более тонкие линии для удаленных узлов
        const depth = d.target.depth;
        return Math.max(1, 6 - depth * 1.5) + 'px';
      });

    // Добавляем узлы
    const node = nodesLayer.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.y},${d.x})`);

    // Добавляем различные формы для узлов в зависимости от ранга
    node.each(function(d: any) {
      const nodeGroup = d3.select(this);
      const nodeStyle = getNodeStyle(d.depth);
      const isLeft = d.y < width / 2;
      
      // Вычисляем размеры текста и прямоугольника
      const textWidth = getTextWidth(d.data.text, nodeStyle.fontSize) + nodeStyle.padding * 2;
      const height = nodeStyle.height;
      
      // Добавляем прямоугольную рамку для всех узлов
      nodeGroup.append('rect')
        .attr('x', -textWidth / 2)
        .attr('y', -height / 2)
        .attr('width', textWidth)
        .attr('height', height)
        .attr('rx', 5)
        .attr('ry', 5)
        .style('fill', nodeStyle.fill)
        .style('stroke', nodeStyle.stroke)
        .style('stroke-width', nodeStyle.strokeWidth);
      
      // Добавляем текст в центр рамки
      nodeGroup.append('text')
        .attr('dy', '.35em')
        .attr('text-anchor', 'middle')
        .style('font-size', `${nodeStyle.fontSize}px`)
        .style('font-weight', nodeStyle.fontWeight)
        .style('fill', nodeStyle.textColor)
        .text(d.data.text);
    });

    // Добавляем обработчики событий для узлов
    node.on('click', (event, d: any) => {
      event.stopPropagation();
      
      // Получаем позицию узла относительно контейнера
      const containerRect = containerRef.current?.getBoundingClientRect();
      const transform = d3.zoomTransform(svg.node() as any);
      const nodeX = d.y * transform.k + transform.x;
      const nodeY = d.x * transform.k + transform.y;
      
      // Проверяем, есть ли у узла родитель
      let parentId;
      if (d.parent) {
        parentId = d.parent.data.id;
      }
      
      // Устанавливаем информацию для редактирования
      setEditingInfo({
        node: d.data,
        text: d.data.text,
        position: { 
          x: nodeX, 
          y: nodeY 
        },
        parentId,
        depth: d.depth
      });
      
      if (onNodeClick) {
        onNodeClick(d.data);
      }
    });

    // Обработчик клика вне узлов для закрытия панели редактирования
    svg.on('click', () => {
      setEditingInfo(null);
    });
    
    // Добавляем data-id атрибут для узлов, чтобы их можно было легко найти
    node.attr('data-id', (d: any) => d.data.id);
    
    // Восстанавливаем предыдущую трансформацию, если она была сохранена
    if (savedTransform) {
      svg.call(zoom.transform as any, savedTransform);
    } else {
      // Или применяем начальную трансформацию для первого рендера
      const gElement = g.node() as SVGGElement;
      if (gElement) {
        const boundingBox = gElement.getBBox();
        
        // Вычисляем масштаб для подгонки всей диаграммы на страницу с отступами
        const padding = 40; // отступ от краев
        const scaleX = (width - padding * 2) / boundingBox.width;
        const scaleY = (height - padding * 2) / boundingBox.height;
        const scale = Math.min(scaleX, scaleY, 0.8); // Ограничиваем масштаб для удобства просмотра
        
        // Центрируем диаграмму
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Создаем начальную трансформацию
        const initialTransform = d3.zoomIdentity
          .translate(centerX, centerY)
          .scale(scale)
          .translate(-boundingBox.x - boundingBox.width/2, -boundingBox.y - boundingBox.height/2);
        
        // Применяем трансформацию
        svg.call(zoom.transform as any, initialTransform);
      } else {
        // Запасной вариант, если не удалось получить границы
        const initialTransform = d3.zoomIdentity.translate(width/2, height/2).scale(0.8);
        svg.call(zoom.transform as any, initialTransform);
      }
    }

  }, [data, onNodeClick, onNodeUpdate, onNodeDelete, dimensions]);

  // Функция для расчета стилей панели редактирования
  const getEditPanelStyle = () => {
    if (!editingInfo || !containerRef.current) return {};
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const isLeft = editingInfo.position.x < dimensions.width / 2;
    const nodeStyle = getNodeStyle(editingInfo.depth);
    
    // Базовое смещение панели относительно узла
    let offsetX = isLeft ? -250 : 50;
    let panelX = editingInfo.position.x + offsetX;
    
    // Размеры панели (приблизительные)
    const panelWidth = 250;
    const panelHeight = 120;
    
    // Проверяем, не выходит ли панель за левый край
    if (panelX < 0) {
      panelX = 10;
    }
    
    // Проверяем, не выходит ли панель за правый край
    if (panelX + panelWidth > containerRect.width) {
      panelX = containerRect.width - panelWidth - 10;
    }
    
    // Позиция по Y - центрируем относительно узла, но проверяем границы
    let panelY = editingInfo.position.y - panelHeight / 2;
    
    // Проверяем, не выходит ли панель за верхний край
    if (panelY < 0) {
      panelY = 10;
    }
    
    // Проверяем, не выходит ли панель за нижний край
    if (panelY + panelHeight > containerRect.height) {
      panelY = containerRect.height - panelHeight - 10;
    }
    
    return {
      position: 'absolute' as 'absolute',
      left: `${panelX}px`,
      top: `${panelY}px`,
      zIndex: 1000
    };
  };

  return (
    <div className="mind-map-wrapper" ref={containerRef}>
      <svg ref={svgRef}></svg>
      
      {editingInfo && (
        <div className="edit-node-panel" style={getEditPanelStyle()}>
          <input
            type="text"
            value={editingInfo.text}
            onChange={(e) => setEditingInfo({...editingInfo, text: e.target.value})}
            onKeyPress={(e) => e.key === 'Enter' && handleEditSubmit()}
            autoFocus
          />
          <div className="edit-node-buttons buttons-row">
            <button onClick={handleEditSubmit} className="save-button">
              Сохранить
            </button>
            <button onClick={handleAddNode} className="add-button">
              +
            </button>
            {editingInfo.depth !== 0 && (
              <button onClick={handleDeleteNode} className="delete-button">
                ×
              </button>
            )}
            <button onClick={() => setEditingInfo(null)} className="cancel-button">
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MindMap; 