        function refreshIcons() {
            if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
        }
        refreshIcons();

        if (window.EPDF_OPEN_TOOL) {
            document.documentElement.classList.add('tool-page-mode');
        }

        // Application Global State
        const state = {
            activeTool: null,
            stagedFiles: [],
            conversionHistory: (function () {
                try { return JSON.parse(localStorage.getItem('epdf_history') || '[]'); } catch (e) { return []; }
            })(),
            currentFilter: 'all',
            // Image tool options
            resizeWidth: 800,
            resizeHeight: 600,
            maintainAspect: true,
            targetSizeKB: 100,
            imageQuality: 80,
            // Signature pad logic
            sigCanvas: null,
            sigCtx: null,
            isDrawingSig: false,
            sigImage: null,
            // PDF Page manipulation lists
            pdfPages: [], // [{pageNum, canvasDataUrl, selected}]
            pdfTextEdits: [], // [{page: 1, text: 'Custom Overlay', x: 50, y: 50}]
            rotateAngle: 90,
            editPdf: null
        };

        // Tool Configurations Database
        const TOOL_CONFIGS = {
            'image-convert-kb': {
                title: 'Image Convert in KB',
                desc: 'Compress and resize image file to hit a target maximum KB limit.',
                icon: 'gauge',
                accept: 'image/jpeg, image/png, image/webp',
                hint: 'Select image file (.jpg, .png, .webp)',
                optionsHtml: `
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Set Target Size Limit (KB):</label>
                            <span id="target-kb-display" class="text-xs font-extrabold text-brand-500 px-2 py-1 bg-brand-500/10 rounded-lg">100 KB</span>
                        </div>
                        <input type="range" id="input-target-kb" min="10" max="1000" step="10" value="100" class="w-full accent-brand-500 cursor-pointer" />
                        <div class="grid grid-cols-4 gap-2 pt-1">
                            <button type="button" class="preset-kb-btn px-2 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition" data-kb="20">20 KB</button>
                            <button type="button" class="preset-kb-btn px-2 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition" data-kb="50">50 KB</button>
                            <button type="button" class="preset-kb-btn px-2 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition" data-kb="100">100 KB</button>
                            <button type="button" class="preset-kb-btn px-2 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition" data-kb="200">200 KB</button>
                        </div>
                    </div>
                `
            },
            'image-resizer': {
                title: 'Image Resizer (Dimensions)',
                desc: 'Change width and height dimensions in pixels.',
                icon: 'scaling',
                accept: 'image/jpeg, image/png, image/webp',
                hint: 'Select image file (.jpg, .png, .webp)',
                optionsHtml: `
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Width (px):</label>
                                <input type="number" id="input-resize-w" value="800" class="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500" />
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Height (px):</label>
                                <input type="number" id="input-resize-h" value="600" class="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500" />
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <input type="checkbox" id="chk-aspect" checked class="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                            <label for="chk-aspect" class="text-xs font-semibold text-slate-700 dark:text-slate-300">Maintain Aspect Ratio</label>
                        </div>
                    </div>
                `
            },
            'compress-image': {
                title: 'Compress Image Quality',
                desc: 'Reduce photo file size with interactive quality slider.',
                icon: 'shrink',
                accept: 'image/jpeg, image/png, image/webp',
                hint: 'Select image file to compress',
                optionsHtml: `
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Quality Factor:</label>
                            <span id="quality-display" class="text-xs font-extrabold text-brand-500 px-2 py-1 bg-brand-500/10 rounded-lg">80%</span>
                        </div>
                        <input type="range" id="input-image-quality" min="10" max="100" value="80" class="w-full accent-brand-500 cursor-pointer" />
                        <div id="image-calc-preview" class="p-3 rounded-xl bg-slate-200/50 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 flex justify-between">
                            <span>Original Size: <strong id="orig-size-label">0 KB</strong></span>
                            <span>Est. New Size: <strong id="est-size-label" class="text-emerald-500">0 KB</strong></span>
                        </div>
                    </div>
                `
            },
            'sign-pdf': {
                title: 'Sign PDF Document',
                desc: 'Draw signature with touchpad/mouse and attach to PDF.',
                icon: 'pen-tool',
                accept: '.pdf, application/pdf',
                hint: 'Select PDF document to sign',
                optionsHtml: `
                    <div class="space-y-3">
                        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Draw Digital Signature Below:</label>
                        <div class="border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-white overflow-hidden relative">
                            <canvas id="sig-pad-canvas" width="500" height="150" class="sig-pad w-full h-36 bg-white"></canvas>
                        </div>
                        <div class="flex justify-between items-center pt-1">
                            <button type="button" id="clear-sig-btn" class="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-bold hover:bg-red-500/20 transition">
                                Clear Signature Pad
                            </button>
                            <span class="text-[11px] text-slate-400">Mouse / Finger Drawing Enabled</span>
                        </div>
                    </div>
                `
            },
            'organise-pages': {
                title: 'Organise PDF Pages',
                desc: 'Reorder pages visually into your preferred order.',
                icon: 'layout-grid',
                accept: '.pdf, application/pdf',
                hint: 'Select multi-page PDF document',
                optionsHtml: `
                    <div class="space-y-3">
                        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Document Page Sequence (Click move arrows):</label>
                        <div id="page-grid-preview" class="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-52 overflow-y-auto p-2">
                            <p class="text-xs text-slate-400 col-span-full text-center py-4">Upload PDF file above to load thumbnails...</p>
                        </div>
                    </div>
                `
            },
            'remove-pages': {
                title: 'Remove PDF Pages',
                desc: 'Click trash icon on pages to delete them from file.',
                icon: 'trash-2',
                accept: '.pdf, application/pdf',
                hint: 'Select PDF document',
                optionsHtml: `
                    <div class="space-y-3">
                        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Click Trash to Mark Pages for Removal:</label>
                        <div id="remove-grid-preview" class="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-52 overflow-y-auto p-2">
                            <p class="text-xs text-slate-400 col-span-full text-center py-4">Upload PDF file above to load thumbnails...</p>
                        </div>
                    </div>
                `
            },
            'edit-pdf': {
                title: 'Edit PDF Text & Add Content',
                desc: 'Render existing PDF pages, add custom text overlay layers.',
                icon: 'file-edit',
                accept: '.pdf, application/pdf',
                hint: 'Select PDF document to edit',
                optionsHtml: `<p class="text-xs text-slate-500 dark:text-slate-400">Upload a PDF to open the full-page editor. Click existing text on the page to edit it.</p>`
            },
            'jpg-to-pdf': {
                title: 'JPG to PDF Converter',
                desc: 'Combines images into a single formatted PDF file.',
                icon: 'file-image',
                accept: 'image/jpeg, image/png, image/webp',
                hint: 'Select image files (.jpg, .png, .webp)',
                optionsHtml: `<p class="text-xs text-slate-500 dark:text-slate-400">All staged images will be formatted into PDF pages.</p>`
            },
            'merge-pdf': {
                title: 'Merge PDF Documents',
                desc: 'Combines multiple PDF files into one file.',
                icon: 'layers',
                accept: '.pdf, application/pdf',
                hint: 'Select 2 or more PDF files',
                optionsHtml: `<p class="text-xs text-slate-500 dark:text-slate-400">Selected PDF files will be merged sequentially.</p>`
            },
            'compress-pdf': {
                title: 'Compress PDF File',
                desc: 'Shrinks PDF document size.',
                icon: 'file-archive',
                accept: '.pdf, application/pdf',
                hint: 'Select PDF document',
                optionsHtml: `<p class="text-xs text-slate-500 dark:text-slate-400">Applies compression algorithms to streamline document size.</p>`
            },
            'protect-pdf': {
                title: 'Protect PDF with Password',
                desc: 'Encrypts your PDF document with security.',
                icon: 'lock',
                accept: '.pdf, application/pdf',
                hint: 'Select PDF to lock',
                optionsHtml: `
                    <div class="space-y-3">
                        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Set Security Password:</label>
                        <input type="password" id="opt-password" placeholder="Enter password..." class="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500" />
                    </div>
                `
            },
            'pdf-to-word': {
                title: 'PDF to Word Converter',
                desc: 'Extract document text into an editable Word (.docx) file.',
                icon: 'file-text',
                accept: '.pdf, application/pdf',
                hint: 'Select PDF document',
                optionsHtml: `<p class="text-xs text-slate-500 dark:text-slate-400">Text will be extracted from every page and packaged as .docx.</p>`
            },
            'word-to-pdf': {
                title: 'Word to PDF Converter',
                desc: 'Convert Word documents (.doc, .docx) into clean PDFs.',
                icon: 'file-type-2',
                accept: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                hint: 'Select Word document (.doc, .docx)',
                optionsHtml: `<p class="text-xs text-slate-500 dark:text-slate-400">Document text will be formatted into a PDF file.</p>`
            },
            'pdf-to-jpg': {
                title: 'PDF to JPG Converter',
                desc: 'Render pages into high-resolution image snapshots.',
                icon: 'image',
                accept: '.pdf, application/pdf',
                hint: 'Select PDF document',
                optionsHtml: `<p class="text-xs text-slate-500 dark:text-slate-400">Each page is exported as JPG. Multi-page files download as a ZIP.</p>`
            },
            'split-pdf': {
                title: 'Split PDF Document',
                desc: 'Extract custom page ranges into individual PDF files.',
                icon: 'scissors',
                accept: '.pdf, application/pdf',
                hint: 'Select PDF document',
                optionsHtml: `
                    <div class="space-y-3">
                        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Page Range (leave empty to split every page):</label>
                        <input type="text" id="input-split-range" placeholder="e.g. 1-3, 5, 7-9" class="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500" />
                    </div>
                `
            },
            'rotate-pdf': {
                title: 'Rotate PDF Pages',
                desc: 'Rotate document pages 90°, 180° or 270° clockwise.',
                icon: 'rotate-cw',
                accept: '.pdf, application/pdf',
                hint: 'Select PDF document',
                optionsHtml: `
                    <div class="space-y-3">
                        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Rotation Angle:</label>
                        <div class="grid grid-cols-3 gap-2">
                            <button type="button" class="rotate-angle-btn px-3 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold" data-angle="90">90°</button>
                            <button type="button" class="rotate-angle-btn px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-brand-600 hover:text-white transition" data-angle="180">180°</button>
                            <button type="button" class="rotate-angle-btn px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-brand-600 hover:text-white transition" data-angle="270">270°</button>
                        </div>
                    </div>
                `
            },
            'text-to-pdf': {
                title: 'Text to PDF Converter',
                desc: 'Package plain text files (.txt) into formatted PDFs.',
                icon: 'file-code-2',
                accept: '.txt, text/plain',
                hint: 'Select text file (.txt)',
                optionsHtml: `<p class="text-xs text-slate-500 dark:text-slate-400">Plain text will be paginated into a formatted PDF document.</p>`
            },
            'unlock-pdf': {
                title: 'Unlock PDF Document',
                desc: 'Remove password protection from a PDF you can open.',
                icon: 'unlock',
                accept: '.pdf, application/pdf',
                hint: 'Select password-protected PDF',
                optionsHtml: `
                    <div class="space-y-3">
                        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Current Password (if required):</label>
                        <input type="password" id="opt-unlock-password" placeholder="Enter current password..." class="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500" />
                    </div>
                `
            },
            'generic': {
                title: 'PDF File Tool Workspace',
                desc: 'Process files safely in browser.',
                icon: 'file-text',
                accept: '*/*',
                hint: 'Select your input document',
                optionsHtml: `<p class="text-xs text-slate-500 dark:text-slate-400">Ready to convert file.</p>`
            }
        };

        document.addEventListener('DOMContentLoaded', () => {
            
            // Theme Mode Setup
            const themeToggleBtn = document.getElementById('theme-toggle');
            if (themeToggleBtn) {
                themeToggleBtn.addEventListener('click', () => {
                    document.documentElement.classList.toggle('dark');
                    const isDark = document.documentElement.classList.contains('dark');
                    localStorage.setItem('epdf_theme', isDark ? 'dark' : 'light');
                });
            }

            if (localStorage.getItem('epdf_theme') === 'light') {
                document.documentElement.classList.remove('dark');
            }

            // Mobile menu drawer
            const mobileBtn = document.getElementById('mobile-menu-btn');
            const mobileMenu = document.getElementById('mobile-menu');
            if (mobileBtn && mobileMenu) {
                mobileBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
            }

            // Search and Category Filter Logic
            const searchInput = document.getElementById('tool-search');
            const clearSearchBtn = document.getElementById('clear-search');
            const toolCards = document.querySelectorAll('.tool-card');
            const noResults = document.getElementById('no-results');
            const filterPills = document.querySelectorAll('.pill-btn');
            const resetSearchBtn = document.getElementById('reset-search-btn');

            function filterTools() {
                if (!searchInput) return;
                const q = searchInput.value.toLowerCase().trim();
                let count = 0;

                toolCards.forEach(card => {
                    const title = (card.getAttribute('data-title') || '').toLowerCase();
                    const category = card.getAttribute('data-category') || '';

                    const matchesSearch = title.includes(q);
                    const matchesCategory = (state.currentFilter === 'all') || category.includes(state.currentFilter);

                    if (matchesSearch && matchesCategory) {
                        card.classList.remove('hidden');
                        count++;
                    } else {
                        card.classList.add('hidden');
                    }
                });

                if (noResults) {
                    if (count === 0) noResults.classList.remove('hidden');
                    else noResults.classList.add('hidden');
                }

                if (clearSearchBtn) {
                    if (q.length > 0) clearSearchBtn.classList.remove('hidden');
                    else clearSearchBtn.classList.add('hidden');
                }
            }

            if (searchInput) searchInput.addEventListener('input', filterTools);
            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', () => {
                    searchInput.value = '';
                    filterTools();
                });
            }

            if (resetSearchBtn) {
                resetSearchBtn.addEventListener('click', () => {
                    searchInput.value = '';
                    state.currentFilter = 'all';
                    updatePillStyles();
                    filterTools();
                });
            }

            filterPills.forEach(pill => {
                pill.addEventListener('click', () => {
                    state.currentFilter = pill.getAttribute('data-filter');
                    updatePillStyles();
                    filterTools();
                });
            });

            function updatePillStyles() {
                filterPills.forEach(p => {
                    if (p.getAttribute('data-filter') === state.currentFilter) {
                        p.className = 'pill-btn active px-4 py-2 rounded-xl bg-brand-600 text-white shadow-md transition whitespace-nowrap';
                    } else {
                        p.className = 'pill-btn px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition whitespace-nowrap';
                    }
                });
            }

            // Modal Initialization
            const modal = document.getElementById('tool-modal');
            const closeModalBtn = document.getElementById('close-modal-btn');
            const modalCancelBtn = document.getElementById('modal-cancel-btn');
            const modalConvertBtn = document.getElementById('modal-convert-btn');
            const modalDropArea = document.getElementById('modal-drop-area');
            const modalFileInput = document.getElementById('modal-file-input');
            const filePreviewList = document.getElementById('file-preview-list');
            const workspacePreview = document.getElementById('workspace-preview');
            const PAGE_PREVIEW_TOOLS = ['organise-pages', 'remove-pages', 'edit-pdf'];
            const IMAGE_PREVIEW_TOOLS = ['image-resizer', 'image-convert-kb', 'compress-image', 'jpg-to-pdf'];

            function isPdfFile(f) {
                return f && ((f.type === 'application/pdf') || (f.name || '').toLowerCase().endsWith('.pdf'));
            }

            function isImageFile(f) {
                return f && (((f.type || '').startsWith('image/')) || /\.(jpe?g|png|webp|gif)$/i.test(f.name || ''));
            }

            function setPreviewChrome(on) {
                const header = document.getElementById('tool-modal-header');
                const footer = document.getElementById('tool-modal-footer');
                const body = document.getElementById('tool-modal-body');
                const optionsBox = document.getElementById('tool-options-container');
                const progress = document.getElementById('modal-progress-container');
                const modalBox = document.getElementById('tool-modal-box');
                const toolId = state.activeTool;
                const editMode = on && toolId === 'edit-pdf';
                function setDisp(el, value) {
                    if (!el) return;
                    if (value === '') el.style.removeProperty('display');
                    else el.style.setProperty('display', value, 'important');
                }
                setDisp(modalDropArea, on ? 'none' : '');
                setDisp(filePreviewList, on ? 'none' : '');
                setDisp(header, (on && (editMode || isDedicatedToolPage())) ? 'none' : '');
                setDisp(footer, editMode ? 'none' : '');
                setDisp(optionsBox, editMode ? 'none' : '');
                setDisp(progress, editMode ? 'none' : '');
                document.documentElement.classList.toggle('preview-edit-pdf', editMode);
                document.body.classList.toggle('preview-edit-pdf', editMode);
                setDisp(workspacePreview, on ? 'flex' : '');
                if (workspacePreview) {
                    workspacePreview.style.flexDirection = 'column';
                    workspacePreview.style.flex = '1 1 auto';
                    workspacePreview.style.minHeight = editMode ? 'calc(100vh - 5rem)' : (on ? '50vh' : '');
                    workspacePreview.style.width = '100%';
                }
                if (body) {
                    body.style.padding = editMode ? '0' : '';
                    body.style.maxHeight = on ? 'none' : '';
                    body.style.overflow = editMode ? 'hidden' : '';
                    body.style.flex = on ? '1 1 auto' : '';
                    setDisp(body, on ? 'flex' : '');
                    body.style.flexDirection = on ? 'column' : '';
                }
                if (modalBox && editMode) {
                    modalBox.style.border = '0';
                    modalBox.style.boxShadow = 'none';
                    modalBox.style.borderRadius = '0';
                    modalBox.style.background = 'transparent';
                } else if (modalBox) {
                    modalBox.style.border = '';
                    modalBox.style.boxShadow = '';
                    modalBox.style.borderRadius = '';
                    modalBox.style.background = '';
                }
            }

            function showWorkspacePreview() {
                if (modalDropArea) modalDropArea.classList.add('hidden');
                if (filePreviewList) filePreviewList.classList.add('hidden');
                if (workspacePreview) workspacePreview.classList.remove('hidden');
                document.documentElement.classList.add('preview-active');
                document.body.classList.add('preview-active');
                setPreviewChrome(true);
            }

            function hideWorkspacePreview() {
                if (workspacePreview) {
                    workspacePreview.classList.add('hidden');
                    workspacePreview.innerHTML = '';
                }
                if (modalDropArea) modalDropArea.classList.remove('hidden');
                if (filePreviewList) filePreviewList.classList.remove('hidden');
                document.documentElement.classList.remove('preview-active');
                document.body.classList.remove('preview-active');
                document.documentElement.classList.remove('preview-edit-pdf');
                document.body.classList.remove('preview-edit-pdf');
                setPreviewChrome(false);
            }

            function updatePreviewToolLayout() {
                const toolId = state.activeTool;
                const file = state.stagedFiles[0];
                const optionsBox = document.getElementById('tool-options-container');
                if (!file) {
                    hideWorkspacePreview();
                    if (optionsBox) optionsBox.classList.remove('hidden');
                    return;
                }
                if (isPdfFile(file) || (IMAGE_PREVIEW_TOOLS.includes(toolId) && isImageFile(file))) {
                    showWorkspacePreview();
                    if (optionsBox) {
                        if (toolId === 'edit-pdf') optionsBox.classList.add('hidden');
                        else optionsBox.classList.remove('hidden');
                    }
                    return;
                }
                hideWorkspacePreview();
                if (optionsBox) optionsBox.classList.remove('hidden');
            }

            function renderImageWorkspacePreview(file) {
                if (!workspacePreview) return;
                showWorkspacePreview();
                const url = URL.createObjectURL(file);
                workspacePreview.innerHTML = `
                    <div class="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-950 overflow-auto min-h-[50vh] p-4">
                        <img src="${url}" alt="Uploaded image preview" class="max-w-full max-h-[72vh] object-contain rounded-xl shadow-lg bg-white" />
                    </div>
                `;
            }

            async function renderGenericPdfPreview(file) {
                if (!workspacePreview) return;
                showWorkspacePreview();
                workspacePreview.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">Loading PDF preview...</p>';
                try {
                    const pdfDoc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
                    const grid = document.createElement('div');
                    grid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-2 overflow-auto min-h-[50vh]';
                    const limit = Math.min(pdfDoc.numPages, 40);
                    for (let i = 1; i <= limit; i++) {
                        const page = await pdfDoc.getPage(i);
                        const viewport = page.getViewport({ scale: 0.45 });
                        const canvas = document.createElement('canvas');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
                        const card = document.createElement('div');
                        card.className = 'relative p-2 rounded-xl bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex flex-col items-center';
                        const img = document.createElement('img');
                        img.src = canvas.toDataURL('image/jpeg', 0.8);
                        img.className = 'w-full object-contain rounded border border-slate-300 dark:border-slate-700 shadow-sm bg-white';
                        img.alt = 'Page ' + i;
                        const label = document.createElement('span');
                        label.className = 'text-[10px] font-bold text-slate-500 mt-1';
                        label.textContent = 'Page ' + i;
                        card.appendChild(img);
                        card.appendChild(label);
                        grid.appendChild(card);
                    }
                    workspacePreview.innerHTML = '';
                    workspacePreview.appendChild(grid);
                } catch (err) {
                    workspacePreview.innerHTML = '<p class="text-xs text-red-400 text-center py-8">Could not preview this PDF.</p>';
                }
            }

            function isDedicatedToolPage() {
                return !!window.EPDF_OPEN_TOOL;
            }

            function homeHref() {
                return (location.pathname.indexOf('/tools/') !== -1) ? '../index.html' : 'index.html';
            }

            function enableFullPageToolMode() {
                document.body.classList.add('tool-page-mode');
                document.documentElement.classList.add('tool-page-mode');
            }

            function openToolModal(toolId, initialFiles = []) {
                state.activeTool = toolId;
                state.stagedFiles = Array.from(initialFiles);

                const config = TOOL_CONFIGS[toolId] || TOOL_CONFIGS['generic'];

                document.getElementById('modal-tool-title').innerText = config.title;
                document.getElementById('modal-tool-desc').innerText = config.desc;
                document.getElementById('modal-file-hints').innerText = config.hint;
                document.getElementById('tool-options-container').innerHTML = config.optionsHtml;
                modalFileInput.setAttribute('accept', config.accept);
                const modalBox = document.getElementById('tool-modal-box');
                if (modalBox) {
                    if (toolId === 'edit-pdf' || isDedicatedToolPage()) modalBox.classList.add('max-w-6xl');
                    else modalBox.classList.remove('max-w-6xl');
                }

                // Reset progress bar
                document.getElementById('modal-progress-container').classList.add('hidden');
                document.getElementById('modal-progress-bar').style.width = '0%';

                if (isDedicatedToolPage()) enableFullPageToolMode();

                renderStagedFiles();
                updatePreviewToolLayout();
                if (modal) modal.classList.remove('hidden');
                refreshIcons();

                // Bind tool-specific UI events
                bindToolOptionEvents(toolId);
            }

            function closeModal() {
                if (isDedicatedToolPage()) {
                    location.href = homeHref();
                    return;
                }
                modal.classList.add('hidden');
                modalDropArea.classList.remove('hidden');
                filePreviewList.classList.remove('hidden');
                state.stagedFiles = [];
                state.activeTool = null;
                state.pdfPages = [];
                state.editPdf = null;
                const modalBox = document.getElementById('tool-modal-box');
                if (modalBox) modalBox.classList.remove('max-w-6xl');
            }

            if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
            if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);

            toolCards.forEach(card => {
                card.addEventListener('click', (e) => {
                    const toolId = card.getAttribute('data-tool-id') || 'generic';
                    if (window.EPDF_OPEN_TOOL && window.EPDF_OPEN_TOOL === toolId) {
                        e.preventDefault();
                        openToolModal(toolId);
                        return;
                    }
                    if (card.tagName === 'A' || card.closest('a[href]')) {
                        return;
                    }
                    openToolModal(toolId);
                });
            });

            if (window.EPDF_OPEN_TOOL) {
                openToolModal(window.EPDF_OPEN_TOOL);
            }

            if (modalDropArea && modalFileInput) {
                modalDropArea.addEventListener('click', () => modalFileInput.click());
            }
            function afterFilesStaged() {
                renderStagedFiles();
                updatePreviewToolLayout();
                const toolId = state.activeTool;
                const f = state.stagedFiles[0];
                if (!f) return;
                if (isPdfFile(f)) {
                    if (toolId === 'edit-pdf') loadEditPdfWorkspace(f);
                    else if (toolId === 'organise-pages' || toolId === 'remove-pages') loadPDFPagesPreview(f, toolId);
                    else renderGenericPdfPreview(f);
                    return;
                }
                if (IMAGE_PREVIEW_TOOLS.includes(toolId) && isImageFile(f)) {
                    renderImageWorkspacePreview(f);
                    if (toolId === 'image-resizer') {
                        const wInput = document.getElementById('input-resize-w');
                        const hInput = document.getElementById('input-resize-h');
                        if (wInput && hInput) {
                            const img = new Image();
                            img.src = URL.createObjectURL(f);
                            img.onload = () => {
                                wInput.value = img.width;
                                hInput.value = img.height;
                                state.resizeWidth = img.width;
                                state.resizeHeight = img.height;
                            };
                        }
                    } else if (toolId === 'compress-image') {
                        updateEstImageSize();
                    }
                }
            }

            if (modalFileInput) {
                modalFileInput.addEventListener('change', (e) => {
                    if (e.target.files.length > 0) {
                        state.stagedFiles.push(...Array.from(e.target.files));
                        afterFilesStaged();
                        e.target.value = '';
                    }
                });
            }

            if (modalDropArea) {
                ['dragenter', 'dragover'].forEach(evt => {
                    modalDropArea.addEventListener(evt, (e) => {
                        e.preventDefault();
                        modalDropArea.classList.add('drag-active');
                    });
                });
                ['dragleave', 'drop'].forEach(evt => {
                    modalDropArea.addEventListener(evt, (e) => {
                        e.preventDefault();
                        modalDropArea.classList.remove('drag-active');
                    });
                });
                modalDropArea.addEventListener('drop', (e) => {
                    if (e.dataTransfer.files.length > 0) {
                        state.stagedFiles.push(...Array.from(e.dataTransfer.files));
                        afterFilesStaged();
                    }
                });
            }

            function bindToolOptionEvents(toolId) {
                if (toolId === 'image-convert-kb') {
                    const kbInput = document.getElementById('input-target-kb');
                    const kbDisplay = document.getElementById('target-kb-display');
                    if (kbInput && kbDisplay) {
                        kbInput.addEventListener('input', () => {
                            state.targetSizeKB = parseInt(kbInput.value);
                            kbDisplay.innerText = state.targetSizeKB + ' KB';
                        });
                    }
                    document.querySelectorAll('.preset-kb-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const val = parseInt(btn.getAttribute('data-kb'));
                            state.targetSizeKB = val;
                            if (kbInput) kbInput.value = val;
                            if (kbDisplay) kbDisplay.innerText = val + ' KB';
                        });
                    });
                } else if (toolId === 'image-resizer') {
                    const wInput = document.getElementById('input-resize-w');
                    const hInput = document.getElementById('input-resize-h');
                    const aspectChk = document.getElementById('chk-aspect');

                    let origAspect = 4/3;
                    if (state.stagedFiles[0]) {
                        const img = new Image();
                        img.src = URL.createObjectURL(state.stagedFiles[0]);
                        img.onload = () => {
                            origAspect = img.width / img.height;
                            if (wInput) wInput.value = img.width;
                            if (hInput) hInput.value = img.height;
                            state.resizeWidth = img.width;
                            state.resizeHeight = img.height;
                        }
                    }

                    if (wInput && hInput && aspectChk) {
                        wInput.addEventListener('input', () => {
                            state.resizeWidth = parseInt(wInput.value) || 100;
                            if (aspectChk.checked && origAspect) {
                                state.resizeHeight = Math.round(state.resizeWidth / origAspect);
                                hInput.value = state.resizeHeight;
                            }
                        });
                        hInput.addEventListener('input', () => {
                            state.resizeHeight = parseInt(hInput.value) || 100;
                            if (aspectChk.checked && origAspect) {
                                state.resizeWidth = Math.round(state.resizeHeight * origAspect);
                                wInput.value = state.resizeWidth;
                            }
                        });
                    }
                } else if (toolId === 'compress-image') {
                    const qInput = document.getElementById('input-image-quality');
                    const qDisplay = document.getElementById('quality-display');
                    if (qInput && qDisplay) {
                        qInput.addEventListener('input', () => {
                            state.imageQuality = parseInt(qInput.value);
                            qDisplay.innerText = state.imageQuality + '%';
                            updateEstImageSize();
                        });
                    }
                    updateEstImageSize();
                } else if (toolId === 'sign-pdf') {
                    initSignaturePad();
                } else if (toolId === 'edit-pdf') {
                    if (state.stagedFiles[0] && isPdfFile(state.stagedFiles[0])) {
                        loadEditPdfWorkspace(state.stagedFiles[0]);
                    }
                } else if (toolId === 'organise-pages' || toolId === 'remove-pages') {
                    if (state.stagedFiles[0] && isPdfFile(state.stagedFiles[0])) {
                        loadPDFPagesPreview(state.stagedFiles[0], toolId);
                    }
                } else if (toolId === 'rotate-pdf') {
                    document.querySelectorAll('.rotate-angle-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            state.rotateAngle = parseInt(btn.getAttribute('data-angle')) || 90;
                            document.querySelectorAll('.rotate-angle-btn').forEach(b => {
                                b.className = 'rotate-angle-btn px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-brand-600 hover:text-white transition';
                            });
                            btn.className = 'rotate-angle-btn px-3 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold';
                        });
                    });
                }
            }

            function updateEstImageSize() {
                const origLabel = document.getElementById('orig-size-label');
                const estLabel = document.getElementById('est-size-label');
                if (state.stagedFiles[0] && origLabel && estLabel) {
                    const bytes = state.stagedFiles[0].size;
                    origLabel.innerText = formatBytes(bytes);
                    const estBytes = Math.round(bytes * (state.imageQuality / 100));
                    estLabel.innerText = formatBytes(estBytes);
                }
            }

            function initSignaturePad() {
                const canvas = document.getElementById('sig-pad-canvas');
                const clearBtn = document.getElementById('clear-sig-btn');
                if (!canvas) return;

                function fitCanvas() {
                    const rect = canvas.getBoundingClientRect();
                    const dpr = window.devicePixelRatio || 1;
                    const w = Math.max(Math.round(rect.width), 300);
                    const h = Math.max(Math.round(rect.height), 140);
                    canvas.width = Math.round(w * dpr);
                    canvas.height = Math.round(h * dpr);
                    const ctx = canvas.getContext('2d');
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = '#000000';
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    state.sigCtx = ctx;
                }
                fitCanvas();
                const ctx = state.sigCtx;
                let isDrawing = false;

                function getPos(e) {
                    const rect = canvas.getBoundingClientRect();
                    const src = (e.touches && e.touches[0]) ? e.touches[0] : e;
                    return {
                        x: src.clientX - rect.left,
                        y: src.clientY - rect.top
                    };
                }

                function startDraw(e) {
                    isDrawing = true;
                    const pos = getPos(e);
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y);
                }

                function draw(e) {
                    if (!isDrawing) return;
                    e.preventDefault();
                    const pos = getPos(e);
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                }

                function stopDraw() {
                    isDrawing = false;
                }

                canvas.addEventListener('mousedown', startDraw);
                canvas.addEventListener('mousemove', draw);
                canvas.addEventListener('mouseup', stopDraw);

                canvas.addEventListener('touchstart', startDraw);
                canvas.addEventListener('touchmove', draw);
                canvas.addEventListener('touchend', stopDraw);

                if (clearBtn) {
                    clearBtn.addEventListener('click', () => {
                        ctx.save();
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.restore();
                    });
                }

                state.sigCanvas = canvas;
            }

            async function loadPDFPagesPreview(file, toolId) {
                try {
                    showWorkspacePreview();
                    if (workspacePreview) workspacePreview.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">Loading PDF pages...</p>';
                    const arrayBuffer = await file.arrayBuffer();
                    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    
                    state.pdfPages = [];

                    const previewLimit = Math.min(pdfDoc.numPages, 40);
                    for (let i = 1; i <= previewLimit; i++) {
                        const page = await pdfDoc.getPage(i);
                        const viewport = page.getViewport({ scale: 0.45 });
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                        
                        const dataUrl = canvas.toDataURL();
                        state.pdfPages.push({
                            pageNum: i,
                            dataUrl: dataUrl,
                            removed: false
                        });
                    }

                    renderPageGridUI(toolId);
                } catch (err) {
                    console.warn("PDF Page Preview Load Warning:", err);
                    if (workspacePreview) workspacePreview.innerHTML = '<p class="text-xs text-red-400 text-center py-8">Could not preview this PDF.</p>';
                }
            }

            function renderPageGridUI(toolId) {
                const gridContainer = workspacePreview || document.getElementById('page-grid-preview') || document.getElementById('remove-grid-preview');
                if (!gridContainer) return;
                showWorkspacePreview();
                gridContainer.innerHTML = '';
                gridContainer.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-2 overflow-auto min-h-[50vh]';

                state.pdfPages.forEach((p, index) => {
                    if (toolId === 'remove-pages' && p.removed) return;

                    const card = document.createElement('div');
                    card.className = 'relative p-2 rounded-xl bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex flex-col items-center group';
                    card.innerHTML = `
                        <img src="${p.dataUrl}" class="w-full object-contain rounded border border-slate-300 dark:border-slate-700 shadow-sm bg-white" />
                        <span class="text-[10px] font-bold text-slate-500 mt-1">Page ${p.pageNum}</span>
                        ${toolId === 'remove-pages' ? `
                            <button class="remove-page-btn absolute top-1 right-1 p-1.5 rounded-lg bg-red-600 text-white shadow hover:scale-110 transition" data-index="${index}">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        ` : ''}
                        ${toolId === 'organise-pages' ? `
                            <div class="flex gap-1 mt-1">
                                <button class="move-left-btn px-1.5 py-0.5 rounded bg-brand-600 text-white text-[10px]" data-index="${index}">←</button>
                                <button class="move-right-btn px-1.5 py-0.5 rounded bg-brand-600 text-white text-[10px]" data-index="${index}">→</button>
                            </div>
                        ` : ''}
                    `;
                    gridContainer.appendChild(card);
                });

                if (toolId === 'remove-pages') {
                    gridContainer.querySelectorAll('.remove-page-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const idx = parseInt(btn.getAttribute('data-index'));
                            state.pdfPages[idx].removed = true;
                            renderPageGridUI(toolId);
                        });
                    });
                } else if (toolId === 'organise-pages') {
                    gridContainer.querySelectorAll('.move-left-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const idx = parseInt(btn.getAttribute('data-index'));
                            if (idx > 0) {
                                const temp = state.pdfPages[idx];
                                state.pdfPages[idx] = state.pdfPages[idx - 1];
                                state.pdfPages[idx - 1] = temp;
                                renderPageGridUI(toolId);
                            }
                        });
                    });
                    gridContainer.querySelectorAll('.move-right-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const idx = parseInt(btn.getAttribute('data-index'));
                            if (idx < state.pdfPages.length - 1) {
                                const temp = state.pdfPages[idx];
                                state.pdfPages[idx] = state.pdfPages[idx + 1];
                                state.pdfPages[idx + 1] = temp;
                                renderPageGridUI(toolId);
                            }
                        });
                    });
                }

                refreshIcons();
            }

            function renderStagedFiles() {
                if (!filePreviewList) return;
                filePreviewList.innerHTML = '';
                if (state.stagedFiles.length === 0) {
                    if (modalConvertBtn) modalConvertBtn.disabled = true;
                    return;
                }

                if (modalConvertBtn) modalConvertBtn.disabled = false;

                state.stagedFiles.forEach((file, index) => {
                    const item = document.createElement('div');
                    item.className = 'flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs';
                    item.innerHTML = `
                        <div class="flex items-center space-x-2 truncate">
                            <i data-lucide="file" class="w-4 h-4 text-brand-500 shrink-0"></i>
                            <span class="font-semibold text-slate-800 dark:text-slate-200 truncate">${file.name}</span>
                            <span class="text-slate-400">(${formatBytes(file.size)})</span>
                        </div>
                        <button class="remove-file-btn p-1 text-slate-400 hover:text-red-500" data-index="${index}">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    `;
                    filePreviewList.appendChild(item);
                });

                filePreviewList.querySelectorAll('.remove-file-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const idx = parseInt(btn.getAttribute('data-index'));
                        state.stagedFiles.splice(idx, 1);
                        if (state.stagedFiles.length === 0) {
                            state.pdfPages = [];
                            state.editPdf = null;
                        }
                        renderStagedFiles();
                        updatePreviewToolLayout();
                    });
                });

                refreshIcons();
            }

            if (modalConvertBtn) modalConvertBtn.addEventListener('click', async () => {
                if (state.stagedFiles.length === 0) return;

                const progressContainer = document.getElementById('modal-progress-container');
                const progressBar = document.getElementById('modal-progress-bar');
                const statusText = document.getElementById('modal-status-text');
                const progressPercent = document.getElementById('modal-progress-percent');

                progressContainer.classList.remove('hidden');
                modalConvertBtn.disabled = true;

                let pct = 0;
                statusText.innerText = "Processing Client File Engine...";

                const interval = setInterval(() => {
                    pct += 20;
                    if (pct > 90) pct = 90;
                    progressBar.style.width = pct + '%';
                    progressPercent.innerText = pct + '%';
                }, 150);

                try {
                    await executeSelectedToolEngine();
                    clearInterval(interval);
                    progressBar.style.width = '100%';
                    progressPercent.innerText = '100%';
                    statusText.innerText = 'Done! Preparing Download...';
                    setTimeout(() => {
                        if (isDedicatedToolPage()) {
                            progressContainer.classList.add('hidden');
                            progressBar.style.width = '0%';
                            modalConvertBtn.disabled = state.stagedFiles.length === 0;
                        } else {
                            closeModal();
                        }
                    }, 800);
                } catch (err) {
                    clearInterval(interval);
                    progressContainer.classList.add('hidden');
                    modalConvertBtn.disabled = false;
                    alert('Could not process this file: ' + (err && err.message ? err.message : 'Unknown error'));
                }
            });

            async function executeSelectedToolEngine() {
                const file = state.stagedFiles[0];
                const toolId = state.activeTool;
                if (!file || !toolId) return;

                if (toolId === 'image-convert-kb') {
                        const compressedBlob = await convertImageToTargetKB(file, state.targetSizeKB);
                        const outName = file.name.replace(/\.[^/.]+$/, "") + `_${state.targetSizeKB}KB.jpg`;
                        downloadBlob(compressedBlob, outName);
                        addHistoryRecord(outName, 'JPG', `Compressed to ${state.targetSizeKB}KB`);
                    } else if (toolId === 'image-resizer') {
                        const resizedBlob = await resizeImageDimensions(file, state.resizeWidth, state.resizeHeight);
                        const outName = file.name.replace(/\.[^/.]+$/, "") + `_${state.resizeWidth}x${state.resizeHeight}.jpg`;
                        downloadBlob(resizedBlob, outName);
                        addHistoryRecord(outName, 'JPG', `Resized ${state.resizeWidth}x${state.resizeHeight}px`);
                    } else if (toolId === 'compress-image') {
                        const compressedBlob = await compressImageQuality(file, state.imageQuality);
                        const outName = file.name.replace(/\.[^/.]+$/, "") + `_compressed.jpg`;
                        downloadBlob(compressedBlob, outName);
                        addHistoryRecord(outName, 'JPG', `Compressed Quality ${state.imageQuality}%`);
                    } else if (toolId === 'jpg-to-pdf') {
                        await engineJpgToPdf();
                    } else if (toolId === 'sign-pdf') {
                        await engineSignPdf(file);
                    } else if (toolId === 'organise-pages') {
                        await engineOrganisePages(file);
                    } else if (toolId === 'remove-pages') {
                        await engineRemovePages(file);
                    } else if (toolId === 'edit-pdf') {
                        await engineEditPdf(file);
                    } else if (toolId === 'merge-pdf') {
                        await engineMergePdf();
                    } else if (toolId === 'compress-pdf') {
                        await engineCompressPdf(file);
                    } else if (toolId === 'pdf-to-word') {
                        await enginePdfToWord(file);
                    } else if (toolId === 'word-to-pdf') {
                        await engineWordToPdf(file);
                    } else if (toolId === 'pdf-to-jpg') {
                        await enginePdfToJpg(file);
                    } else if (toolId === 'protect-pdf') {
                        await engineProtectPdf(file);
                    } else if (toolId === 'split-pdf') {
                        await engineSplitPdf(file);
                    } else if (toolId === 'rotate-pdf') {
                        await engineRotatePdf(file);
                    } else if (toolId === 'text-to-pdf') {
                        await engineTextToPdf(file);
                    } else if (toolId === 'unlock-pdf') {
                        await engineUnlockPdf(file);
                    }
            }

            function stemName(f) {
                return (f && f.name ? f.name : 'document').replace(/\.[^/.]+$/, '');
            }

            async function loadPdfLibDoc(file, options) {
                const bytes = await file.arrayBuffer();
                return PDFLib.PDFDocument.load(bytes, options || { ignoreEncryption: true });
            }

            async function renderPdfPageDataUrl(pdfDoc, pageNum, scale) {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: scale || 1.5 });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: viewport.width, height: viewport.height };
            }

            async function engineJpgToPdf() {
                const { jsPDF } = window.jspdf;
                const files = state.stagedFiles.filter(f => (f.type || '').startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(f.name || ''));
                if (!files.length) throw new Error('Please add at least one image.');
                let doc = null;
                for (let i = 0; i < files.length; i++) {
                    const img = new Image();
                    img.src = await readFileAsDataURL(files[i]);
                    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                    const w = img.width;
                    const h = img.height;
                    const orient = w >= h ? 'landscape' : 'portrait';
                    if (!doc) doc = new jsPDF({ orientation: orient, unit: 'px', format: [w, h] });
                    else doc.addPage([w, h], orient);
                    doc.addImage(dataUrl, 'JPEG', 0, 0, w, h);
                }
                const outName = stemName(files[0]) + '_converted.pdf';
                doc.save(outName);
                addHistoryRecord(outName, 'PDF', 'JPG to PDF');
            }

            async function engineSignPdf(file) {
                if (!state.sigCanvas) throw new Error('Signature pad is not ready.');
                const srcDoc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
                const { jsPDF } = window.jspdf;
                const sigDataUrl = state.sigCanvas.toDataURL('image/png');
                let outDoc = null;
                for (let i = 1; i <= srcDoc.numPages; i++) {
                    const rendered = await renderPdfPageDataUrl(srcDoc, i, 1.4);
                    const orient = rendered.width >= rendered.height ? 'landscape' : 'portrait';
                    if (!outDoc) outDoc = new jsPDF({ orientation: orient, unit: 'px', format: [rendered.width, rendered.height] });
                    else outDoc.addPage([rendered.width, rendered.height], orient);
                    outDoc.addImage(rendered.dataUrl, 'JPEG', 0, 0, rendered.width, rendered.height);
                    if (i === srcDoc.numPages) {
                        const sigW = Math.min(220, rendered.width * 0.28);
                        const sigH = sigW * 0.3;
                        outDoc.addImage(sigDataUrl, 'PNG', rendered.width - sigW - 24, rendered.height - sigH - 24, sigW, sigH);
                    }
                }
                const outName = stemName(file) + '_signed.pdf';
                outDoc.save(outName);
                addHistoryRecord(outName, 'PDF', 'Digital Signature Attached');
            }

            async function engineOrganisePages(file) {
                const src = await loadPdfLibDoc(file);
                const out = await PDFLib.PDFDocument.create();
                let order = (state.pdfPages && state.pdfPages.length)
                    ? state.pdfPages.map(p => p.pageNum - 1).filter(i => i >= 0 && i < src.getPageCount())
                    : src.getPageIndices();
                if (state.pdfPages && state.pdfPages.length && state.pdfPages.length < src.getPageCount()) {
                    for (let i = state.pdfPages.length; i < src.getPageCount(); i++) order.push(i);
                }
                if (!order.length) order = src.getPageIndices();
                const copied = await out.copyPages(src, order);
                copied.forEach(p => out.addPage(p));
                const bytes = await out.save();
                const outName = stemName(file) + '_modified.pdf';
                downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
                addHistoryRecord(outName, 'PDF', 'Reordered Pages');
            }

            async function engineRemovePages(file) {
                const src = await loadPdfLibDoc(file);
                const out = await PDFLib.PDFDocument.create();
                let keep;
                if (state.pdfPages && state.pdfPages.length) {
                    keep = state.pdfPages.filter(p => !p.removed).map(p => p.pageNum - 1);
                    for (let i = state.pdfPages.length; i < src.getPageCount(); i++) keep.push(i);
                } else {
                    keep = src.getPageIndices();
                }
                keep = keep.filter(i => i >= 0 && i < src.getPageCount());
                if (!keep.length) throw new Error('At least one page must remain.');
                const copied = await out.copyPages(src, keep);
                copied.forEach(p => out.addPage(p));
                const bytes = await out.save();
                const outName = stemName(file) + '_modified.pdf';
                downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
                addHistoryRecord(outName, 'PDF', 'Removed Pages');
            }

            function collectEditPdfTextBlocks() {
                const wrap = document.getElementById('pdf-edit-page-wrap');
                if (!wrap || !state.editPdf) return;
                const page = state.editPdf.pages[state.editPdf.currentPage - 1];
                if (!page) return;
                page.blocks.forEach((block, idx) => {
                    const el = wrap.querySelector('.pdf-edit-text[data-idx="' + idx + '"]');
                    if (el) block.text = el.innerText;
                });
            }

            function groupPdfTextItems(items, viewport, scale) {
                const rows = [];
                items.forEach(item => {
                    if (!item.str || !item.str.trim()) return;
                    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                    const x = tx[4];
                    const fontSize = Math.hypot(tx[0], tx[1]);
                    const y = tx[5] - fontSize;
                    const w = (item.width || 0) * scale;
                    let row = null;
                    for (let i = 0; i < rows.length; i++) {
                        if (Math.abs(rows[i].y - y) <= Math.max(3, fontSize * 0.35)) {
                            row = rows[i];
                            break;
                        }
                    }
                    if (!row) {
                        row = { y: y, fontSize: fontSize, items: [] };
                        rows.push(row);
                    }
                    row.items.push({ x: x, y: y, w: w, fontSize: fontSize, str: item.str });
                    row.fontSize = Math.max(row.fontSize, fontSize);
                });
                rows.sort((a, b) => a.y - b.y);
                const blocks = [];
                rows.forEach(row => {
                    row.items.sort((a, b) => a.x - b.x);
                    let cur = null;
                    row.items.forEach(it => {
                        const gap = cur ? it.x - (cur.x + cur.w) : 0;
                        if (!cur || gap > Math.max(10, it.fontSize * 1.4)) {
                            if (cur) blocks.push(cur);
                            cur = {
                                x: it.x,
                                y: it.y,
                                w: it.w,
                                h: it.fontSize * 1.2,
                                fontSize: it.fontSize,
                                text: it.str
                            };
                        } else {
                            const space = gap > it.fontSize * 0.18 ? ' ' : '';
                            cur.text += space + it.str;
                            cur.w = (it.x + it.w) - cur.x;
                            cur.fontSize = Math.max(cur.fontSize, it.fontSize);
                            cur.h = Math.max(cur.h, it.fontSize * 1.2);
                        }
                    });
                    if (cur) blocks.push(cur);
                });
                return blocks;
            }

            function getEditPreviewHost() {
                return workspacePreview || document.getElementById('edit-canvas-preview');
            }

            function readFileAsArrayBuffer(file) {
                return new Promise((resolve, reject) => {
                    const fileReader = new FileReader();
                    fileReader.onload = function () { resolve(this.result); };
                    fileReader.onerror = reject;
                    fileReader.readAsArrayBuffer(file);
                });
            }

            async function loadEditPdfWorkspace(file) {
                const host = getEditPreviewHost();
                if (!host) return;
                showWorkspacePreview();
                host.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">Rendering PDF page...</p>';

                const arrayBuffer = await readFileAsArrayBuffer(file);
                const typedArray = new Uint8Array(arrayBuffer);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                const scale = 1.5;
                const pages = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: scale });
                    const content = await page.getTextContent();
                    pages.push({
                        pageNum: i,
                        width: viewport.width,
                        height: viewport.height,
                        blocks: groupPdfTextItems(content.items, viewport, scale)
                    });
                }

                state.editPdf = {
                    pdf: pdf,
                    pages: pages,
                    currentPage: 1,
                    scale: scale
                };
                await renderEditPdfPage();
            }

            async function shiftEditPdfPage(delta) {
                if (!state.editPdf) return;
                collectEditPdfTextBlocks();
                const next = state.editPdf.currentPage + delta;
                if (next < 1 || next > state.editPdf.pages.length) return;
                state.editPdf.currentPage = next;
                await renderEditPdfPage();
            }

            async function renderEditPdfPage() {
                const host = getEditPreviewHost();
                if (!host || !state.editPdf) return;
                const pageMeta = state.editPdf.pages[state.editPdf.currentPage - 1];
                const total = state.editPdf.pages.length;
                const current = state.editPdf.currentPage;
                host.innerHTML = `
                    <div id="edit-pdf-toolbar" class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                        <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">Click existing text on the page to edit it:</span>
                        <div class="flex items-center gap-2">
                            <button type="button" id="edit-prev-page" class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition">Prev</button>
                            <span id="edit-page-label" class="text-[11px] font-extrabold text-brand-500 min-w-[88px] text-center">Page ${current} / ${total}</span>
                            <button type="button" id="edit-next-page" class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition">Next</button>
                            <button type="button" id="edit-save-pdf" class="ml-2 px-3 py-1 rounded-lg bg-brand-600 text-white text-[11px] font-bold hover:bg-brand-500 transition">Download</button>
                        </div>
                    </div>
                    <div id="edit-canvas-preview" class="flex-1 overflow-auto flex justify-center items-start bg-[#eef2f7] dark:bg-slate-950"></div>
                `;
                const canvasHost = document.getElementById('edit-canvas-preview');
                const wrap = document.createElement('div');
                wrap.id = 'pdf-edit-page-wrap';
                wrap.className = 'pdf-edit-page';
                wrap.style.width = pageMeta.width + 'px';
                wrap.style.height = pageMeta.height + 'px';

                const canvas = document.createElement('canvas');
                canvas.id = 'pdf-preview';
                const ctx = canvas.getContext('2d');
                wrap.appendChild(canvas);
                canvasHost.appendChild(wrap);

                const page = await state.editPdf.pdf.getPage(current);
                const viewport = page.getViewport({ scale: state.editPdf.scale || 1.5 });
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                pageMeta.blocks.forEach((block, idx) => {
                    const el = document.createElement('div');
                    el.className = 'pdf-edit-text';
                    el.contentEditable = 'true';
                    el.setAttribute('data-idx', String(idx));
                    el.innerText = block.text;
                    el.style.left = block.x + 'px';
                    el.style.top = block.y + 'px';
                    el.style.minWidth = Math.max(block.w, 12) + 'px';
                    el.style.minHeight = Math.max(block.h, 12) + 'px';
                    el.style.fontSize = Math.max(block.fontSize, 8) + 'px';
                    el.addEventListener('input', () => {
                        block.text = el.innerText;
                    });
                    wrap.appendChild(el);
                });
                const prevBtn = document.getElementById('edit-prev-page');
                const nextBtn = document.getElementById('edit-next-page');
                const saveBtn = document.getElementById('edit-save-pdf');
                if (prevBtn) prevBtn.addEventListener('click', () => shiftEditPdfPage(-1));
                if (nextBtn) nextBtn.addEventListener('click', () => shiftEditPdfPage(1));
                if (saveBtn && modalConvertBtn) saveBtn.addEventListener('click', () => modalConvertBtn.click());
                refreshIcons();
            }

            async function engineEditPdf(file) {
                if (!state.editPdf || !state.editPdf.pages.length) {
                    await loadEditPdfWorkspace(file);
                }
                collectEditPdfTextBlocks();
                const { jsPDF } = window.jspdf;
                let outDoc = null;
                const scale = state.editPdf.scale || 1.5;
                for (let i = 0; i < state.editPdf.pages.length; i++) {
                    const pageMeta = state.editPdf.pages[i];
                    const pdfPage = await state.editPdf.pdf.getPage(i + 1);
                    const viewport = pdfPage.getViewport({ scale: scale });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    await pdfPage.render({ canvasContext: ctx, viewport: viewport }).promise;
                    pageMeta.blocks.forEach(block => {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(block.x - 1, block.y - 1, Math.max(block.w + 4, 8), Math.max(block.h + 2, 8));
                        ctx.fillStyle = '#111111';
                        ctx.textBaseline = 'top';
                        ctx.font = Math.max(block.fontSize, 8) + 'px Helvetica, Arial, sans-serif';
                        const lines = (block.text || '').split('\n');
                        lines.forEach((line, li) => {
                            ctx.fillText(line, block.x, block.y + (li * block.fontSize * 1.15));
                        });
                    });
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                    const orient = viewport.width >= viewport.height ? 'landscape' : 'portrait';
                    if (!outDoc) outDoc = new jsPDF({ orientation: orient, unit: 'px', format: [viewport.width, viewport.height] });
                    else outDoc.addPage([viewport.width, viewport.height], orient);
                    outDoc.addImage(dataUrl, 'JPEG', 0, 0, viewport.width, viewport.height);
                }
                const outName = stemName(file) + '_edited.pdf';
                outDoc.save(outName);
                addHistoryRecord(outName, 'PDF', 'Edited PDF Text');
            }

            async function engineMergePdf() {
                const files = state.stagedFiles.filter(f => (f.type === 'application/pdf') || /\.pdf$/i.test(f.name || ''));
                if (files.length < 2) throw new Error('Select 2 or more PDF files to merge.');
                const out = await PDFLib.PDFDocument.create();
                for (const f of files) {
                    const src = await loadPdfLibDoc(f);
                    const copied = await out.copyPages(src, src.getPageIndices());
                    copied.forEach(p => out.addPage(p));
                }
                const bytes = await out.save();
                const outName = stemName(files[0]) + '_merged.pdf';
                downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
                addHistoryRecord(outName, 'PDF', 'Merged PDFs');
            }

            async function engineCompressPdf(file) {
                const srcDoc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
                const { jsPDF } = window.jspdf;
                let outDoc = null;
                for (let i = 1; i <= srcDoc.numPages; i++) {
                    const rendered = await renderPdfPageDataUrl(srcDoc, i, 1.1);
                    const orient = rendered.width >= rendered.height ? 'landscape' : 'portrait';
                    if (!outDoc) outDoc = new jsPDF({ orientation: orient, unit: 'px', format: [rendered.width, rendered.height] });
                    else outDoc.addPage([rendered.width, rendered.height], orient);
                    outDoc.addImage(rendered.dataUrl, 'JPEG', 0, 0, rendered.width, rendered.height, undefined, 'FAST');
                }
                const outName = stemName(file) + '_compressed.pdf';
                outDoc.save(outName);
                addHistoryRecord(outName, 'PDF', 'Compressed PDF');
            }

            async function enginePdfToWord(file) {
                const srcDoc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
                const paragraphs = [];
                for (let i = 1; i <= srcDoc.numPages; i++) {
                    const page = await srcDoc.getPage(i);
                    const content = await page.getTextContent();
                    const text = content.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
                    if (text) paragraphs.push(text);
                    else paragraphs.push('[Page ' + i + ']');
                }
                const bodyXml = paragraphs.map(p => {
                    const esc = p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return '<w:p><w:r><w:t xml:space="preserve">' + esc + '</w:t></w:r></w:p>';
                }).join('');
                const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + bodyXml + '</w:body></w:document>';
                const zip = new JSZip();
                zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
                zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
                zip.file('word/document.xml', documentXml);
                const blob = await zip.generateAsync({ type: 'blob' });
                const outName = stemName(file) + '.docx';
                downloadBlob(blob, outName);
                addHistoryRecord(outName, 'DOCX', 'PDF to Word');
            }

            async function engineWordToPdf(file) {
                const { jsPDF } = window.jspdf;
                let text = '';
                const name = (file.name || '').toLowerCase();
                if (name.endsWith('.docx') && window.mammoth) {
                    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
                    text = result.value || '';
                } else {
                    text = await file.text();
                }
                if (!text.trim()) text = '(Empty document)';
                const doc = new jsPDF({ unit: 'pt', format: 'a4' });
                const lines = doc.splitTextToSize(text, 515);
                let y = 48;
                lines.forEach(line => {
                    if (y > 780) { doc.addPage(); y = 48; }
                    doc.setFontSize(11);
                    doc.text(line, 40, y);
                    y += 16;
                });
                const outName = stemName(file) + '.pdf';
                doc.save(outName);
                addHistoryRecord(outName, 'PDF', 'Word to PDF');
            }

            async function enginePdfToJpg(file) {
                const srcDoc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
                const blobs = [];
                for (let i = 1; i <= srcDoc.numPages; i++) {
                    const page = await srcDoc.getPage(i);
                    const viewport = page.getViewport({ scale: 2 });
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
                    blobs.push({ name: stemName(file) + '_page_' + i + '.jpg', blob: blob });
                }
                if (blobs.length === 1) {
                    downloadBlob(blobs[0].blob, blobs[0].name);
                    addHistoryRecord(blobs[0].name, 'JPG', 'PDF to JPG');
                } else {
                    const zip = new JSZip();
                    blobs.forEach(b => zip.file(b.name, b.blob));
                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    const outName = stemName(file) + '_pages.zip';
                    downloadBlob(zipBlob, outName);
                    addHistoryRecord(outName, 'ZIP', 'PDF to JPG');
                }
            }

            async function engineProtectPdf(file) {
                const password = (document.getElementById('opt-password')?.value || '').trim();
                if (!password) throw new Error('Please enter a password.');
                const src = await loadPdfLibDoc(file);
                const out = await PDFLib.PDFDocument.create();
                const copied = await out.copyPages(src, src.getPageIndices());
                copied.forEach(p => out.addPage(p));
                if (typeof out.encrypt === 'function') {
                    out.encrypt({ userPassword: password, ownerPassword: password, permissions: { printing: 'highResolution', copying: false, modifying: false } });
                } else {
                    throw new Error('Password encryption is unavailable. Reload the page and try again.');
                }
                const bytes = await out.save();
                const outName = stemName(file) + '_protected.pdf';
                downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
                addHistoryRecord(outName, 'PDF', 'Password Protected');
            }

            function parsePageRange(str, pageCount) {
                const set = new Set();
                const raw = (str || '').trim();
                if (!raw) {
                    for (let i = 1; i <= pageCount; i++) set.add(i);
                    return Array.from(set);
                }
                raw.split(',').forEach(part => {
                    const p = part.trim();
                    if (!p) return;
                    if (p.indexOf('-') >= 0) {
                        const bits = p.split('-');
                        let a = parseInt(bits[0], 10);
                        let b = parseInt(bits[1], 10);
                        if (!a || !b) return;
                        if (a > b) { const t = a; a = b; b = t; }
                        for (let i = a; i <= b; i++) if (i >= 1 && i <= pageCount) set.add(i);
                    } else {
                        const n = parseInt(p, 10);
                        if (n >= 1 && n <= pageCount) set.add(n);
                    }
                });
                return Array.from(set).sort((a, b) => a - b);
            }

            async function engineSplitPdf(file) {
                const src = await loadPdfLibDoc(file);
                const count = src.getPageCount();
                const rangeInput = document.getElementById('input-split-range');
                const pages = parsePageRange(rangeInput ? rangeInput.value : '', count);
                if (!pages.length) throw new Error('No valid pages in range.');
                if (pages.length === 1) {
                    const out = await PDFLib.PDFDocument.create();
                    const copied = await out.copyPages(src, [pages[0] - 1]);
                    out.addPage(copied[0]);
                    const bytes = await out.save();
                    const outName = stemName(file) + '_page_' + pages[0] + '.pdf';
                    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
                    addHistoryRecord(outName, 'PDF', 'Split PDF');
                    return;
                }
                const zip = new JSZip();
                for (const n of pages) {
                    const out = await PDFLib.PDFDocument.create();
                    const copied = await out.copyPages(src, [n - 1]);
                    out.addPage(copied[0]);
                    const bytes = await out.save();
                    zip.file(stemName(file) + '_page_' + n + '.pdf', bytes);
                }
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const outName = stemName(file) + '_split.zip';
                downloadBlob(zipBlob, outName);
                addHistoryRecord(outName, 'ZIP', 'Split PDF');
            }

            async function engineRotatePdf(file) {
                const angle = state.rotateAngle || 90;
                const src = await loadPdfLibDoc(file);
                src.getPages().forEach(page => {
                    const current = page.getRotation().angle || 0;
                    page.setRotation(PDFLib.degrees((current + angle) % 360));
                });
                const bytes = await src.save();
                const outName = stemName(file) + '_rotated.pdf';
                downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
                addHistoryRecord(outName, 'PDF', 'Rotated ' + angle + '°');
            }

            async function engineTextToPdf(file) {
                const { jsPDF } = window.jspdf;
                const text = await file.text();
                const doc = new jsPDF({ unit: 'pt', format: 'a4' });
                const lines = doc.splitTextToSize(text || '(Empty file)', 515);
                let y = 48;
                lines.forEach(line => {
                    if (y > 780) { doc.addPage(); y = 48; }
                    doc.setFontSize(11);
                    doc.text(line, 40, y);
                    y += 16;
                });
                const outName = stemName(file) + '.pdf';
                doc.save(outName);
                addHistoryRecord(outName, 'PDF', 'Text to PDF');
            }

            async function engineUnlockPdf(file) {
                const password = (document.getElementById('opt-unlock-password')?.value || '').trim();
                let srcDoc;
                try {
                    srcDoc = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), password: password || '' }).promise;
                } catch (e) {
                    throw new Error('Could not open PDF. Check the password.');
                }
                const { jsPDF } = window.jspdf;
                let outDoc = null;
                for (let i = 1; i <= srcDoc.numPages; i++) {
                    const rendered = await renderPdfPageDataUrl(srcDoc, i, 1.5);
                    const orient = rendered.width >= rendered.height ? 'landscape' : 'portrait';
                    if (!outDoc) outDoc = new jsPDF({ orientation: orient, unit: 'px', format: [rendered.width, rendered.height] });
                    else outDoc.addPage([rendered.width, rendered.height], orient);
                    outDoc.addImage(rendered.dataUrl, 'JPEG', 0, 0, rendered.width, rendered.height);
                }
                const outName = stemName(file) + '_unlocked.pdf';
                outDoc.save(outName);
                addHistoryRecord(outName, 'PDF', 'Unlocked PDF');
            }

            // Image Compression Helpers (Binary Search Quality Calculation for Target KB)
            async function convertImageToTargetKB(file, targetKB) {
                const img = await loadImageFromFile(file);

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;
                const maxBytes = targetKB * 1024;

                // Scale down dimensions if huge
                if (width * height > 2000000) {
                    width = Math.round(width * 0.7);
                    height = Math.round(height * 0.7);
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                let minQ = 0.05, maxQ = 0.95, bestBlob = null;
                for (let i = 0; i < 6; i++) {
                    const midQ = (minQ + maxQ) / 2;
                    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', midQ));
                    if (blob.size <= maxBytes) {
                        bestBlob = blob;
                        minQ = midQ;
                    } else {
                        maxQ = midQ;
                    }
                }

                if (!bestBlob) {
                    canvas.width = Math.round(width * 0.6);
                    canvas.height = Math.round(height * 0.6);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    bestBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.5));
                }

                return bestBlob;
            }

            async function resizeImageDimensions(file, w, h) {
                const img = await loadImageFromFile(file);

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
            }

            async function compressImageQuality(file, qualityPct) {
                const img = await loadImageFromFile(file);

                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, img.width, img.height);

                return new Promise(res => canvas.toBlob(res, 'image/jpeg', qualityPct / 100));
            }

            // Universal Dropzone Bindings
            const mainDropzone = document.getElementById('main-dropzone');
            const mainFileInput = document.getElementById('main-file-input');

            if (mainDropzone && mainFileInput) {
                mainDropzone.addEventListener('click', () => mainFileInput.click());
                mainFileInput.addEventListener('change', (e) => {
                    if (e.target.files.length > 0) autoDetectAndOpenTool(e.target.files);
                });

                ['dragenter', 'dragover'].forEach(evt => {
                    mainDropzone.addEventListener(evt, (e) => {
                        e.preventDefault();
                        mainDropzone.classList.add('drag-active');
                    });
                });

                ['dragleave', 'drop'].forEach(evt => {
                    mainDropzone.addEventListener(evt, (e) => {
                        e.preventDefault();
                        mainDropzone.classList.remove('drag-active');
                    });
                });

                mainDropzone.addEventListener('drop', (e) => {
                    if (e.dataTransfer.files.length > 0) autoDetectAndOpenTool(e.dataTransfer.files);
                });
            }

            function autoDetectAndOpenTool(files) {
                const firstFile = files[0];
                if (!firstFile) return;
                const name = (firstFile.name || '').toLowerCase();
                const type = firstFile.type || '';
                let detectedTool = 'compress-pdf';

                if (type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(name)) {
                    detectedTool = 'image-convert-kb';
                } else if (type === 'application/pdf' || name.endsWith('.pdf')) {
                    detectedTool = 'compress-pdf';
                } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
                    detectedTool = 'word-to-pdf';
                } else if (name.endsWith('.txt') || type === 'text/plain') {
                    detectedTool = 'text-to-pdf';
                }

                if (isDedicatedToolPage()) {
                    state.stagedFiles = Array.from(files);
                    afterFilesStaged();
                    return;
                }
                openToolModal(detectedTool, files);
            }

            // LocalStorage Download History Management
            function addHistoryRecord(filename, type, action) {
                const record = {
                    id: Date.now(),
                    name: filename,
                    type: type,
                    action: action,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                state.conversionHistory.unshift(record);
                if (state.conversionHistory.length > 10) state.conversionHistory.pop();

                localStorage.setItem('epdf_history', JSON.stringify(state.conversionHistory));
                renderHistoryUI();
            }

            function renderHistoryUI() {
                const historyList = document.getElementById('history-list');
                const badge = document.getElementById('history-badge');

                if (badge) badge.innerText = state.conversionHistory.length;
                if (!historyList) return;

                historyList.innerHTML = '';

                if (state.conversionHistory.length === 0) {
                    historyList.innerHTML = `
                        <div class="text-center py-6 text-slate-400 text-xs">
                            No processed files yet. Use any tool above to convert or edit files!
                        </div>
                    `;
                    return;
                }

                state.conversionHistory.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'flex items-center justify-between p-3.5 rounded-2xl glass-card text-xs hover:border-brand-500/30 transition';
                    row.innerHTML = `
                        <div class="flex items-center space-x-3">
                            <div class="p-2 rounded-xl bg-brand-500/10 text-brand-500 font-bold">
                                ${item.type}
                            </div>
                            <div>
                                <div class="font-bold text-slate-900 dark:text-white">${item.name}</div>
                                <div class="text-[10px] text-slate-400">${item.action} • ${item.timestamp}</div>
                            </div>
                        </div>
                        <button class="redownload-btn px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-brand-600 hover:text-white text-slate-700 dark:text-slate-300 transition font-semibold" data-name="${item.name}">
                            <i data-lucide="download" class="w-3.5 h-3.5 inline mr-1"></i> Re-Download
                        </button>
                    `;
                    historyList.appendChild(row);
                });

                historyList.querySelectorAll('.redownload-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        alert('Original files stay only in your browser session. Please convert the file again to download it.');
                    });
                });

                refreshIcons();
            }

            const clearHistBtn = document.getElementById('clear-history-btn');
            if (clearHistBtn) {
                clearHistBtn.addEventListener('click', () => {
                    state.conversionHistory = [];
                    localStorage.removeItem('epdf_history');
                    renderHistoryUI();
                });
            }

            // FAQ Accordion
            document.querySelectorAll('.faq-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const content = btn.nextElementSibling;
                    const icon = btn.querySelector('i');
                    const isHidden = content.classList.contains('hidden');

                    document.querySelectorAll('.faq-content').forEach(c => c.classList.add('hidden'));
                    document.querySelectorAll('.faq-btn i').forEach(i => i.style.transform = 'rotate(0deg)');

                    if (isHidden) {
                        content.classList.remove('hidden');
                        if (icon) icon.style.transform = 'rotate(180deg)';
                    }
                });
            });

            // Initial UI Sync
            renderHistoryUI();

            // General Helpers
            function formatBytes(bytes) {
                if (!bytes || bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }

            function downloadBlob(blob, filename) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            function readFileAsDataURL(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            function loadImageFromFile(file) {
                return readFileAsDataURL(file).then((url) => new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error('Could not read this image file.'));
                    img.src = url;
                }));
            }

        });
    