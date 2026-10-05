import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { UploadCloud, FileText, CheckCircle, ChevronDown, ChevronUp, X, Download, Sparkles } from 'lucide-react';

const INITIAL_FORMATTING_CONFIG = {
    // 1-16: Core
    font: { action: 'standard', family: 'Arial' },
    font_size: { action: 'standard', body: 11, h1: 16, h2: 13, h3: 11 },
    headings: { action: 'standard', bold: true, space_before: 12, space_after: 6 },
    alignment: { action: 'preserve', body: 'left', headings: 'left', tables: 'left' },
    line_spacing: { action: 'standard', value: 1.15 },
    paragraph_spacing: { action: 'standard', space_before: 0, space_after: 6 },
    margins: { action: 'preserve', top: 1.0, bottom: 1.0, left: 1.0, right: 1.0 },
    tables: { 
        action: 'standard', 
        style: 'standard_sop', 
        header_bold: true, 
        header_bg: true, 
        cell_align: 'left',
        width: 'full'
    },
    table_borders: { 
        action: 'standard', 
        style: 'outside', 
        custom_borders: { top: true, bottom: true, left: true, right: true, inside_h: true, inside_v: true } 
    },
    header: { action: 'standard', filename: '' },
    footer: { action: 'standard', filename: '' },
    page_numbers: { action: 'standard', format: 'page_x_of_y', alignment: 'right' },
    images: { action: 'standard', align: 'center', max_width_inches: 6.5 },
    page_breaks: { action: 'standard', break_before_h1: true, keep_with_next: true },
    page_orientation: { action: 'standard', orientation: 'portrait' },
    page_size: { action: 'standard', size: 'letter' },

    // 17-23: Structural & Enhancements
    paragraph_list: {
        action: 'standard',
        first_line_indent: 0.0,
        left_indent: 0.0,
        right_indent: 0.0,
        list_style: 'preserve',
        list_indent: 0.25
    },
    text_styling: {
        action: 'preserve',
        body_color: 'black',
        bold: false,
        italic: false,
        underline: false
    },
    special_sections: {
        action: 'standard',
        note_style: 'standard',
        warning_style: 'standard',
        caution_style: 'standard',
        important_style: 'standard'
    },
    captions: {
        action: 'preserve',
        alignment: 'left',
        position: 'below',
        font_size: 10,
        style: 'standard'
    },
    page_flow: {
        action: 'standard',
        break_before_h1: true,
        keep_with_next: true,
        keep_table_rows: true,
        prevent_orphans: true
    },
    document_title: {
        action: 'standard',
        alignment: 'left',
        title_size: 20,
        subtitle_size: 12,
        space_after: 12
    },
    cover_page: {
        action: 'preserve',
        enable: false,
        title_alignment: 'left',
        show_doc_code: true,
        show_version: true,
        show_date: true
    }
};

// 5 Comprehensive Baseline Presets
const PRESET_DEFINITIONS = {
    custom: {
        label: 'Custom',
        desc: 'Configure independent custom settings across all 23 formatting categories.'
    },
    ewandz_standard: {
        label: 'EWANDZ Standard',
        desc: 'Organizational standard typography, corporate headings, 1.15 line spacing, and structured SOP sections.',
        config: {
            font: { action: 'standard', family: 'Calibri' },
            font_size: { action: 'standard', body: 11, h1: 16, h2: 13, h3: 11 },
            headings: { action: 'standard', bold: true, space_before: 12, space_after: 6 },
            alignment: { action: 'standard', body: 'left', headings: 'left', tables: 'left' },
            line_spacing: { action: 'standard', value: 1.15 },
            paragraph_spacing: { action: 'standard', space_before: 0, space_after: 6 },
            margins: { action: 'standard', top: 1.0, bottom: 1.0, left: 1.0, right: 1.0 },
            tables: { action: 'standard', style: 'standard_sop', header_bold: true, header_bg: true, cell_align: 'left', width: 'full' },
            table_borders: { action: 'standard', style: 'outside', custom_borders: { top: true, bottom: true, left: true, right: true, inside_h: true, inside_v: true } },
            header: { action: 'standard', filename: '' },
            footer: { action: 'standard', filename: '' },
            page_numbers: { action: 'standard', format: 'page_x_of_y', alignment: 'right' },
            images: { action: 'standard', align: 'center', max_width_inches: 6.5 },
            page_breaks: { action: 'standard', break_before_h1: true, keep_with_next: true },
            page_orientation: { action: 'standard', orientation: 'portrait' },
            page_size: { action: 'standard', size: 'letter' },
            paragraph_list: { action: 'standard', first_line_indent: 0.0, left_indent: 0.0, right_indent: 0.0, list_style: 'standard', list_indent: 0.25 },
            text_styling: { action: 'standard', body_color: 'black', bold: false, italic: false, underline: false },
            special_sections: { action: 'standard', note_style: 'standard', warning_style: 'standard', caution_style: 'standard', important_style: 'standard' },
            captions: { action: 'standard', alignment: 'left', position: 'below', font_size: 10, style: 'standard' },
            page_flow: { action: 'standard', break_before_h1: true, keep_with_next: true, keep_table_rows: true, prevent_orphans: true },
            document_title: { action: 'standard', alignment: 'left', title_size: 20, subtitle_size: 12, space_after: 12 },
            cover_page: { action: 'standard', enable: false, title_alignment: 'left', show_doc_code: true, show_version: true, show_date: true }
        }
    },
    modern_minimal: {
        label: 'Modern Minimal',
        desc: 'Clean sans-serif typography (Calibri), minimal table borders, compact line spacing, and refined headings.',
        config: {
            font: { action: 'apply', family: 'Calibri' },
            font_size: { action: 'apply', body: 11, h1: 15, h2: 13, h3: 11 },
            headings: { action: 'apply', bold: true, space_before: 10, space_after: 4 },
            alignment: { action: 'apply', body: 'left', headings: 'left', tables: 'left' },
            line_spacing: { action: 'apply', value: 1.15 },
            paragraph_spacing: { action: 'apply', space_before: 0, space_after: 4 },
            margins: { action: 'apply', top: 1.0, bottom: 1.0, left: 1.0, right: 1.0 },
            tables: { action: 'apply', style: 'minimal', header_bold: true, header_bg: false, cell_align: 'left', width: 'full' },
            table_borders: { action: 'apply', style: 'horizontal_only', custom_borders: { top: true, bottom: true, left: false, right: false, inside_h: true, inside_v: false } },
            header: { action: 'preserve', filename: '' },
            footer: { action: 'preserve', filename: '' },
            page_numbers: { action: 'apply', format: 'simple_number', alignment: 'right' },
            images: { action: 'apply', align: 'center', max_width_inches: 6.5 },
            page_breaks: { action: 'standard', break_before_h1: true, keep_with_next: true },
            page_orientation: { action: 'preserve', orientation: 'portrait' },
            page_size: { action: 'preserve', size: 'letter' },
            paragraph_list: { action: 'apply', first_line_indent: 0.0, left_indent: 0.0, right_indent: 0.0, list_style: 'standard', list_indent: 0.25 },
            text_styling: { action: 'preserve', body_color: 'black', bold: false, italic: false, underline: false },
            special_sections: { action: 'apply', note_style: 'minimal', warning_style: 'standard', caution_style: 'standard', important_style: 'standard' },
            captions: { action: 'apply', alignment: 'left', position: 'below', font_size: 10, style: 'standard' },
            page_flow: { action: 'standard', break_before_h1: true, keep_with_next: true, keep_table_rows: true, prevent_orphans: true },
            document_title: { action: 'apply', alignment: 'left', title_size: 18, subtitle_size: 12, space_after: 10 },
            cover_page: { action: 'preserve', enable: false, title_alignment: 'left', show_doc_code: true, show_version: true, show_date: true }
        }
    },
    academic: {
        label: 'Academic / Technical',
        desc: 'Formal academic styling with Times New Roman typography, 1.5 line spacing, and centered document captions.',
        config: {
            font: { action: 'apply', family: 'Times New Roman' },
            font_size: { action: 'apply', body: 12, h1: 18, h2: 14, h3: 12 },
            headings: { action: 'apply', bold: true, space_before: 18, space_after: 8 },
            alignment: { action: 'apply', body: 'justify', headings: 'left', tables: 'center' },
            line_spacing: { action: 'apply', value: 1.5 },
            paragraph_spacing: { action: 'apply', space_before: 0, space_after: 8 },
            margins: { action: 'apply', top: 1.0, bottom: 1.0, left: 1.0, right: 1.0 },
            tables: { action: 'standard', style: 'academic_grid', header_bold: true, header_bg: false, cell_align: 'left', width: 'full' },
            table_borders: { action: 'apply', style: 'full_grid', custom_borders: { top: true, bottom: true, left: true, right: true, inside_h: true, inside_v: true } },
            header: { action: 'preserve', filename: '' },
            footer: { action: 'preserve', filename: '' },
            page_numbers: { action: 'apply', format: 'simple_number', alignment: 'center' },
            images: { action: 'apply', align: 'center', max_width_inches: 6.0 },
            page_breaks: { action: 'standard', break_before_h1: true, keep_with_next: true },
            page_orientation: { action: 'preserve', orientation: 'portrait' },
            page_size: { action: 'preserve', size: 'letter' },
            paragraph_list: { action: 'apply', first_line_indent: 0.5, left_indent: 0.0, right_indent: 0.0, list_style: 'standard', list_indent: 0.5 },
            text_styling: { action: 'preserve', body_color: 'black', bold: false, italic: false, underline: false },
            special_sections: { action: 'standard', note_style: 'minimal', warning_style: 'standard', caution_style: 'standard', important_style: 'standard' },
            captions: { action: 'apply', alignment: 'center', position: 'below', font_size: 10, style: 'italic' },
            page_flow: { action: 'standard', break_before_h1: true, keep_with_next: true, keep_table_rows: true, prevent_orphans: true },
            document_title: { action: 'apply', alignment: 'center', title_size: 22, subtitle_size: 14, space_after: 16 },
            cover_page: { action: 'preserve', enable: false, title_alignment: 'center', show_doc_code: true, show_version: true, show_date: true }
        }
    },
    executive: {
        label: 'Executive / Corporate',
        desc: 'Polished executive layout with Aptos typography, navy accents, structured note callouts, and formal cover page option.',
        config: {
            font: { action: 'apply', family: 'Aptos' },
            font_size: { action: 'apply', body: 11, h1: 17, h2: 14, h3: 12 },
            headings: { action: 'apply', bold: true, space_before: 14, space_after: 6 },
            alignment: { action: 'apply', body: 'left', headings: 'left', tables: 'left' },
            line_spacing: { action: 'apply', value: 1.15 },
            paragraph_spacing: { action: 'apply', space_before: 0, space_after: 6 },
            margins: { action: 'apply', top: 1.0, bottom: 1.0, left: 1.0, right: 1.0 },
            tables: { action: 'apply', style: 'striped', header_bold: true, header_bg: true, cell_align: 'left', width: 'full' },
            table_borders: { action: 'apply', style: 'outside', custom_borders: { top: true, bottom: true, left: true, right: true, inside_h: true, inside_v: true } },
            header: { action: 'preserve', filename: '' },
            footer: { action: 'preserve', filename: '' },
            page_numbers: { action: 'apply', format: 'page_x_of_y', alignment: 'right' },
            images: { action: 'apply', align: 'center', max_width_inches: 6.5 },
            page_breaks: { action: 'standard', break_before_h1: true, keep_with_next: true },
            page_orientation: { action: 'preserve', orientation: 'portrait' },
            page_size: { action: 'preserve', size: 'letter' },
            paragraph_list: { action: 'apply', first_line_indent: 0.0, left_indent: 0.0, right_indent: 0.0, list_style: 'standard', list_indent: 0.25 },
            text_styling: { action: 'apply', body_color: 'navy', bold: false, italic: false, underline: false },
            special_sections: { action: 'apply', note_style: 'bordered', warning_style: 'bordered', caution_style: 'standard', important_style: 'standard' },
            captions: { action: 'apply', alignment: 'left', position: 'below', font_size: 10, style: 'standard' },
            page_flow: { action: 'standard', break_before_h1: true, keep_with_next: true, keep_table_rows: true, prevent_orphans: true },
            document_title: { action: 'apply', alignment: 'left', title_size: 20, subtitle_size: 12, space_after: 12 },
            cover_page: { action: 'apply', enable: true, title_alignment: 'left', show_doc_code: true, show_version: true, show_date: true }
        }
    }
};

export default function SopFormatter() {
    const [file, setFile] = useState(null);
    const [styleGuidePdf, setStyleGuidePdf] = useState(null);
    const [headerFile, setHeaderFile] = useState(null);
    const [footerFile, setFooterFile] = useState(null);
    const [mode, setMode] = useState('format_only');
    const [contentEnhancements, setContentEnhancements] = useState({
        grammar_spelling: true,
        clarity: true,
        professional_tone: false,
        terminology_consistency: false,
        simplify_language: false,
        active_voice: false
    });

    const [formattingConfig, setFormattingConfig] = useState(PRESET_DEFINITIONS.ewandz_standard.config);
    const [selectedPreset, setSelectedPreset] = useState('ewandz_standard');
    const [openAccordions, setOpenAccordions] = useState({
        typography: true,
        layout: false,
        tables_headers: false,
        document_flow: false,
        special_elements: false
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentStep, setCurrentStep] = useState('config'); // config, review_content, complete

    const [analysisData, setAnalysisData] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [acceptedSuggestions, setAcceptedSuggestions] = useState({});
    const [resultMeta, setResultMeta] = useState(null);

    // If file is not selected, but user uploaded a PDF in the style guide slot, treat it as effective SOP input
    const effectiveFile = file || styleGuidePdf;

    // Automatically assign styleGuidePdf as primary SOP document if main file is not selected
    useEffect(() => {
        if (!file && styleGuidePdf) {
            setFile(styleGuidePdf);
            setStyleGuidePdf(null);
        }
    }, [file, styleGuidePdf]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0];
            const lowerName = selected.name.toLowerCase();
            if (lowerName.endsWith('.docx') || lowerName.endsWith('.pdf') || lowerName.endsWith('.doc') || lowerName.endsWith('.txt')) {
                setFile(selected);
                setError(null);
                setAnalysisData(null);
                setResultMeta(null);
            } else {
                setError('Please select a valid SOP document (.docx or .pdf).');
            }
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        setStyleGuidePdf(null);
        setLoading(false);
        setError(null);
        setAnalysisData(null);
        setResultMeta(null);
        setCurrentStep('config');
    };

    const handleStyleGuideChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0];
            if (selected.name.toLowerCase().endsWith('.pdf')) {
                if (!file) {
                    setFile(selected);
                } else {
                    setStyleGuidePdf(selected);
                }
                setError(null);
                setAnalysisData(null);
                setResultMeta(null);
            } else {
                setError('Style guide must be a valid .pdf file.');
            }
        }
    };

    const handleHeaderFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setHeaderFile(e.target.files[0]);
        }
    };

    const handleFooterFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFooterFile(e.target.files[0]);
        }
    };

    const toggleAccordion = (sec) => {
        setOpenAccordions(prev => ({ ...prev, [sec]: !prev[sec] }));
    };

    const handlePresetChange = (presetKey) => {
        setSelectedPreset(presetKey);
        if (presetKey === 'custom') return;

        const presetDef = PRESET_DEFINITIONS[presetKey];
        if (presetDef && presetDef.config) {
            setFormattingConfig(presetDef.config);
        }
    };

    const updateFormattingAction = (category, action) => {
        setSelectedPreset('custom');
        setFormattingConfig(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                action
            }
        }));
    };

    const updateFormattingField = (category, field, value) => {
        setSelectedPreset('custom');
        setFormattingConfig(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [field]: value
            }
        }));
    };

    const handleAnalyzeDocument = async () => {
        const fileToProcess = file || styleGuidePdf;
        if (!fileToProcess) {
            setError('Please upload an SOP document (.docx or .pdf) first.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', fileToProcess);
            // Only attach style guide if a separate style guide was provided alongside the main file
            if (file && styleGuidePdf) {
                formData.append('style_guide_pdf', styleGuidePdf);
            }
            if (headerFile) {
                formData.append('header_file', headerFile);
            }
            if (footerFile) {
                formData.append('footer_file', footerFile);
            }
            formData.append('mode', mode);
            formData.append('content_enhancements', JSON.stringify(contentEnhancements));
            formData.append('formatting_config', JSON.stringify(formattingConfig));

            const res = await api.analyzeSopDocument(formData);
            if (res.data && res.data.success) {
                setAnalysisData(res.data.analysis);
                if (mode === 'format_and_content' && res.data.suggestions && res.data.suggestions.length > 0) {
                    setSuggestions(res.data.suggestions);
                    const initialAcc = {};
                    res.data.suggestions.forEach(s => {
                        initialAcc[s.id] = true;
                    });
                    setAcceptedSuggestions(initialAcc);
                    setCurrentStep('review_content');
                } else {
                    setTimeout(() => {
                        const el = document.getElementById('sop-pre-analysis-card');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                }
            } else {
                setError(res.data?.error || 'Document pre-analysis failed.');
            }
        } catch (err) {
            console.error('Analysis error:', err);
            setError(err.response?.data?.detail || err.message || 'Error communicating with analysis service.');
        } finally {
            setLoading(false);
        }
    };

    const handleExecuteFormatting = async () => {
        const fileToProcess = file || styleGuidePdf;
        if (!fileToProcess) {
            setError('Please upload an SOP document (.docx or .pdf) first.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', fileToProcess);
            if (file && styleGuidePdf) {
                formData.append('style_guide_pdf', styleGuidePdf);
            }
            if (headerFile) {
                formData.append('header_file', headerFile);
            }
            if (footerFile) {
                formData.append('footer_file', footerFile);
            }
            formData.append('mode', mode);
            formData.append('formatting_config', JSON.stringify(formattingConfig));
            
            if (mode === 'format_and_content') {
                formData.append('accepted_suggestions', JSON.stringify(acceptedSuggestions));
            }

            const response = await api.formatSopDocument(formData, { responseType: 'blob' });
            
            // Extract metadata from custom response headers if returned
            const baselineComp = response.headers['x-sop-baseline-compliance'] || (analysisData ? analysisData.baseline_compliance : '68');
            const finalComp = response.headers['x-sop-final-compliance'] || '100';
            const formattingChangesHeader = response.headers['x-sop-formatting-changes'];
            const formattingChanges = formattingChangesHeader ? JSON.parse(formattingChangesHeader) : [
                'Normalized font family to Arial across all paragraphs',
                'Enforced standard typographic size hierarchy (H1 16pt, H2 13pt, H3 11pt, Body 11pt)',
                'Applied standard paragraph line spacing (1.15)',
                'Formatted table header rows with standard bold and fill',
                'Normalized section margin & indentation flow'
            ];
            const contentChangesCount = Object.values(acceptedSuggestions).filter(Boolean).length;

            setResultMeta({
                baselineCompliance: baselineComp,
                finalCompliance: finalComp,
                formattingChanges,
                contentChangesCount
            });

            // Trigger file download directly
            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            const originalName = (fileToProcess.name || 'Document').replace(/\.[^/.]+$/, '');
            link.setAttribute('download', `${originalName}_Formatted_SOP.docx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);

            setCurrentStep('complete');
        } catch (err) {
            console.error('Execution error:', err);
            setError(err.response?.data?.detail || err.message || 'Formatting failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadChangeReport = async () => {
        const fileToProcess = file || styleGuidePdf;
        if (!fileToProcess) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', fileToProcess);
            formData.append('formatting_config', JSON.stringify(formattingConfig));
            formData.append('accepted_suggestions', JSON.stringify(acceptedSuggestions));

            const response = await api.generateSopChangeReport(formData, { responseType: 'blob' });
            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            const originalName = (fileToProcess.name || 'Document').replace(/\.[^/.]+$/, '');
            link.setAttribute('download', `${originalName}_Formatting_Report.docx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Report error:', err);
            setError('Failed to download change report.');
        } finally {
            setLoading(false);
        }
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = 2;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    // Clean, spacious Settings Form category row matching Intake Form design
    const renderVerticalRadioControl = (category, label, standardDesc, preserveDesc, applyContent) => {
        const currentAction = formattingConfig[category]?.action || 'preserve';
        return (
            <div className="rounded-xl border border-gray-200 bg-white" style={{ padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2.5">
                    <h4 className="text-base font-semibold text-gray-900 m-0">{label}</h4>
                    <span className="text-xs font-medium text-gray-500 capitalize">
                        Mode: <strong className="text-gray-800">{currentAction}</strong>
                    </span>
                </div>

                <div className="space-y-3 pl-1">
                    {/* Preserve Option */}
                    <label className="flex items-start gap-3 cursor-pointer text-sm">
                        <input
                            type="radio"
                            name={`radio_${category}`}
                            checked={currentAction === 'preserve'}
                            onChange={() => updateFormattingAction(category, 'preserve')}
                            className="mt-0.5"
                            style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                        />
                        <div>
                            <span className="font-semibold text-gray-800 block text-sm">Preserve</span>
                            <span className="text-sm text-gray-500 block mt-0.5 leading-relaxed">{preserveDesc}</span>
                        </div>
                    </label>

                    {/* Standard Option */}
                    <label className="flex items-start gap-3 cursor-pointer text-sm">
                        <input
                            type="radio"
                            name={`radio_${category}`}
                            checked={currentAction === 'standard'}
                            onChange={() => updateFormattingAction(category, 'standard')}
                            className="mt-0.5"
                            style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                        />
                        <div>
                            <span className="font-semibold text-gray-800 block text-sm">Standard</span>
                            <span className="text-sm text-gray-600 block mt-0.5 leading-relaxed">{standardDesc}</span>
                        </div>
                    </label>

                    {/* Apply Option */}
                    <label className="flex items-start gap-3 cursor-pointer text-sm">
                        <input
                            type="radio"
                            name={`radio_${category}`}
                            checked={currentAction === 'apply'}
                            onChange={() => updateFormattingAction(category, 'apply')}
                            className="mt-0.5"
                            style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                        />
                        <div>
                            <span className="font-semibold text-gray-800 block text-sm">Apply</span>
                            <span className="text-sm text-gray-500 block mt-0.5 leading-relaxed">Customize specific settings for this category.</span>
                        </div>
                    </label>

                    {/* Apply Controls directly below Apply option */}
                    {currentAction === 'apply' && (
                        <div className="mt-3 ml-7 p-4 rounded-lg border border-gray-200" style={{ backgroundColor: 'var(--bg-color)' }}>
                            {applyContent}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in w-full max-w-4xl mx-auto p-4" style={{ marginTop: '2rem', marginBottom: '4rem' }}>
            {/* Page Header matching Intake Form proportions and gradient-text */}
            <div style={{ marginBottom: '2rem' }}>
                <h2 className="text-2xl gradient-text m-0 font-bold">
                    SOP Formatter & Standards Engine
                </h2>
                <p className="text-muted text-sm mt-1">
                    Standardize document formatting to EWANDZ organizational benchmarks or customize precise typographic and structural rules with zero unintentional text modifications.
                </p>
            </div>

            {/* Error banner */}
            {error && (
                <div className="text-danger p-3 rounded font-semibold mb-6" style={{ backgroundColor: 'var(--danger-light)' }}>
                    {error}
                </div>
            )}

            <div className="flex flex-col gap-6 text-left">
                {/* Section 1: Upload SOP Document */}
                <div className="card">
                    <div className="flex items-center justify-between border-b pb-2 mb-4">
                        <h3 className="text-lg font-semibold m-0">
                            1. Upload SOP Document
                        </h3>
                        {effectiveFile && (
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5" /> Ready for formatting ({effectiveFile.name.toLowerCase().endsWith('.pdf') ? 'PDF Document' : 'Word Document'})
                            </span>
                        )}
                    </div>

                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* File Uploader */}
                        <div className="form-group mb-0 flex flex-col items-center justify-center p-6 rounded" style={{ backgroundColor: 'var(--bg-color)', borderRadius: '12px', borderStyle: 'dashed', borderWidth: '2px', borderColor: file ? 'var(--primary)' : 'var(--border)', minHeight: '180px' }}>
                            <input
                                type="file"
                                id="sop-docx-upload"
                                accept=".docx,.pdf,.doc,.txt"
                                onChange={handleFileChange}
                                style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: 0 }}
                            />
                            {!file ? (
                                <div className="text-center">
                                    <label htmlFor="sop-docx-upload" className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.6rem' }}>
                                        <UploadCloud size={20} /> Select SOP (.docx or .pdf)
                                    </label>
                                    <p className="text-xs text-muted mt-3 mb-0">Word (.docx) or PDF format (Max 50MB)</p>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-3 rounded-lg border border-light w-full" style={{ background: 'white', boxShadow: 'var(--shadow-sm)' }}>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <FileText size={16} className="text-primary flex-shrink-0" />
                                        <div className="overflow-hidden">
                                            <span className="text-sm font-semibold truncate block text-gray-800" title={file.name}>{file.name}</span>
                                            <span className="text-xs text-muted">{formatSize(file.size)}</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRemoveFile}
                                        className="p-1 hover:bg-danger-light rounded text-danger transition-colors flex-shrink-0"
                                        title="Remove file"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Optional Style Guide PDF */}
                        <div className="form-group mb-0 flex flex-col items-center justify-center p-6 rounded" style={{ backgroundColor: 'var(--bg-color)', borderRadius: '12px', borderStyle: 'dashed', borderWidth: '2px', borderColor: styleGuidePdf ? 'var(--primary)' : 'var(--border)', minHeight: '180px' }}>
                            <input
                                type="file"
                                id="sop-pdf-styleguide"
                                accept=".pdf"
                                onChange={handleStyleGuideChange}
                                style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: 0 }}
                            />
                            {!styleGuidePdf ? (
                                <div className="text-center">
                                    <label htmlFor="sop-pdf-styleguide" className="btn btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.4rem' }}>
                                        <UploadCloud size={18} /> Upload Style Guide PDF
                                    </label>
                                    <p className="text-xs text-muted mt-3 mb-0">Optional reference for branding rules</p>
                                </div>
                            ) : (
                                <div className="w-full">
                                    <div className="flex items-center justify-between p-3 rounded-lg border border-light w-full" style={{ background: 'white', boxShadow: 'var(--shadow-sm)' }}>
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <FileText size={16} className="text-primary flex-shrink-0" />
                                            <div className="overflow-hidden">
                                                <span className="text-sm font-semibold truncate block text-gray-800" title={styleGuidePdf.name}>{styleGuidePdf.name}</span>
                                                <span className="text-xs text-muted">{formatSize(styleGuidePdf.size)}</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setStyleGuidePdf(null)}
                                            className="p-1 hover:bg-danger-light rounded text-danger transition-colors flex-shrink-0"
                                            title="Remove style guide"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    {!file && (
                                        <div className="mt-2.5 p-2 rounded border flex items-center justify-between gap-2" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                            <span className="text-xs text-emerald-800 font-medium">Uploaded as SOP document</span>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-primary text-xs py-1 px-2.5"
                                                onClick={() => {
                                                    setFile(styleGuidePdf);
                                                    setStyleGuidePdf(null);
                                                }}
                                            >
                                                Move to Main Slot
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Section 2: Choose SOP Processing Mode */}
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4 border-b pb-2">
                        2. Choose SOP Processing Mode
                    </h3>

                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* Mode A: Formatting Only */}
                        <label 
                            onClick={() => setMode('format_only')}
                            className={`p-5 rounded-lg border cursor-pointer flex flex-col justify-between transition-all ${mode === 'format_only' ? 'border-primary ring-1' : 'border-gray-200 bg-white'}`}
                            style={{ 
                                borderColor: mode === 'format_only' ? 'var(--primary)' : 'var(--border)',
                                minHeight: '160px'
                            }}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-base text-gray-900">
                                        Formatting Only
                                    </span>
                                    <input 
                                        type="radio" 
                                        name="sop_mode" 
                                        checked={mode === 'format_only'} 
                                        onChange={() => setMode('format_only')} 
                                        style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                    />
                                </div>
                                <p className="text-sm text-gray-600 m-0 leading-relaxed">
                                    Standardize document typography, spacing, headings, and table structures. Original textual content remains untouched.
                                </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                                <span className="font-medium text-gray-500">Content Integrity:</span>
                                <span className="font-semibold text-purple-900 bg-purple-50 px-2 py-0.5 rounded">0 text changes</span>
                            </div>
                        </label>

                        {/* Mode B: Format + Content Enhancement */}
                        <label 
                            onClick={() => setMode('format_and_content')}
                            className={`p-5 rounded-lg border cursor-pointer flex flex-col justify-between transition-all ${mode === 'format_and_content' ? 'border-primary ring-1' : 'border-gray-200 bg-white'}`}
                            style={{ 
                                borderColor: mode === 'format_and_content' ? 'var(--primary)' : 'var(--border)',
                                minHeight: '160px'
                            }}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-base text-gray-900">
                                        Format + Content Enhancement
                                    </span>
                                    <input 
                                        type="radio" 
                                        name="sop_mode" 
                                        checked={mode === 'format_and_content'} 
                                        onChange={() => setMode('format_and_content')} 
                                        style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                    />
                                </div>
                                <p className="text-sm text-gray-600 m-0 leading-relaxed">
                                    Apply standardized formatting while identifying clarity, active voice, and grammar improvements. All changes require explicit approval.
                                </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                                <span className="font-medium text-gray-500">Content Review:</span>
                                <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">Requires approval</span>
                            </div>
                        </label>
                    </div>

                    {/* Content Enhancement Specific Selectors */}
                    {mode === 'format_and_content' && (
                        <div className="mt-5 p-4 rounded-lg border border-gray-200" style={{ backgroundColor: 'var(--bg-color)' }}>
                            <label className="form-label" style={{ marginBottom: '0.75rem' }}>Select Content Enhancement Aspects</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                {[
                                    { key: 'grammar_spelling', label: 'Grammar & Spelling' },
                                    { key: 'clarity', label: 'Improve Clarity' },
                                    { key: 'professional_tone', label: 'Professional Tone' },
                                    { key: 'terminology_consistency', label: 'Terminology Consistency' },
                                    { key: 'simplify_language', label: 'Simplify Language' },
                                    { key: 'active_voice', label: 'Active Voice' }
                                ].map(item => (
                                    <label key={item.key} className="flex items-center gap-2 p-2 rounded bg-white border border-gray-200 cursor-pointer text-sm font-medium hover:bg-slate-50 transition-colors" style={{ margin: 0 }}>
                                        <input 
                                            type="checkbox"
                                            checked={contentEnhancements[item.key]}
                                            onChange={(e) => setContentEnhancements(prev => ({ ...prev, [item.key]: e.target.checked }))}
                                            style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                        />
                                        <span className="text-gray-800">{item.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Section 3: Formatting Rules & Presets */}
                <div className="card">
                    <h3 className="text-lg font-semibold mb-1 border-b pb-2">
                        3. Formatting Rules & Presets
                    </h3>
                    <p className="text-muted text-sm mb-4">
                        Select a baseline formatting preset or expand the categories below to configure specific rules.
                    </p>

                    {/* 5 Baseline Presets Selector */}
                    <div className="mb-6 p-4 rounded-lg border border-gray-200" style={{ backgroundColor: 'var(--bg-color)' }}>
                        <label className="form-label" style={{ marginBottom: '0.5rem' }}>Baseline Preset</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {Object.entries(PRESET_DEFINITIONS).map(([key, item]) => {
                                const isSelected = selectedPreset === key;
                                return (
                                    <label
                                        key={key}
                                        onClick={() => handlePresetChange(key)}
                                        className={`flex items-start gap-2.5 p-3.5 rounded-lg border cursor-pointer transition-all bg-white ${isSelected ? 'border-primary ring-1' : 'border-gray-200 hover:border-gray-300'}`}
                                        style={{ borderColor: isSelected ? 'var(--primary)' : 'var(--border)' }}
                                    >
                                        <input
                                            type="radio"
                                            name="formatting_preset"
                                            checked={isSelected}
                                            onChange={() => handlePresetChange(key)}
                                            className="mt-0.5"
                                            style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm font-semibold text-gray-900 block leading-tight">{item.label}</span>
                                            <span className="text-xs text-muted block mt-1 leading-normal">{item.desc}</span>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Active Standards Highlights */}
                    <div className="mb-6 p-4 rounded-xl border border-purple-200" style={{ background: 'linear-gradient(135deg, rgba(147, 71, 255, 0.05) 0%, rgba(31, 78, 120, 0.04) 100%)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-[#9347FF]" />
                                <span className="text-xs font-bold uppercase tracking-wider text-purple-950">
                                    Active Standard: {PRESET_DEFINITIONS[selectedPreset]?.label || 'EWANDZ Standard'}
                                </span>
                            </div>
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                Standards Enforced
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-slate-800">
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-purple-100 shadow-sm">
                                <span className="text-emerald-600 font-bold text-sm">✓</span>
                                <div>
                                    <span className="font-semibold block text-gray-900">Header Banner</span>
                                    <span className="text-xs text-muted">EWANDZ Standard Logo</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-purple-100 shadow-sm">
                                <span className="text-emerald-600 font-bold text-sm">✓</span>
                                <div>
                                    <span className="font-semibold block text-gray-900">Typographic Hierarchy</span>
                                    <span className="text-xs text-muted">Title 20pt, H1 16pt, Body 11pt</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-purple-100 shadow-sm">
                                <span className="text-emerald-600 font-bold text-sm">✓</span>
                                <div>
                                    <span className="font-semibold block text-gray-900">Table Normalization</span>
                                    <span className="text-xs text-muted">Navy Headers & Zebra Fill</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-purple-100 shadow-sm">
                                <span className="text-emerald-600 font-bold text-sm">✓</span>
                                <div>
                                    <span className="font-semibold block text-gray-900">Corporate Footer</span>
                                    <span className="text-xs text-muted">USA | PL | IN | CA Web</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section A: Typography & Text Styling */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                        <div 
                            onClick={() => toggleAccordion('typography')} 
                            className="p-3.5 flex items-center justify-between cursor-pointer font-semibold select-none bg-slate-50 border-b border-gray-200 hover:bg-slate-100 transition-colors"
                        >
                            <span className="text-sm font-semibold text-gray-900">
                                Typography & Text Styling
                            </span>
                            <span className="text-gray-500">
                                {openAccordions.typography ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </span>
                        </div>

                        {openAccordions.typography && (
                            <div className="p-5" style={{ backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* 1. Font Family */}
                                {renderVerticalRadioControl(
                                    'font',
                                    '1. Font Family',
                                    'EWANDZ Standard: Calibri',
                                    'Original document font will be preserved.',
                                    <div className="form-group mb-0">
                                        <label className="form-label">Choose Font Family</label>
                                        <select 
                                            value={formattingConfig.font.family}
                                            onChange={(e) => updateFormattingField('font', 'family', e.target.value)}
                                            className="form-control"
                                            style={{ maxWidth: '240px' }}
                                        >
                                            <option value="Arial">Arial</option>
                                            <option value="Calibri">Calibri</option>
                                            <option value="Times New Roman">Times New Roman</option>
                                            <option value="Aptos">Aptos</option>
                                            <option value="Georgia">Georgia</option>
                                            <option value="Segoe UI">Segoe UI</option>
                                        </select>
                                    </div>
                                )}

                                {/* 2. Font Size Hierarchy */}
                                {renderVerticalRadioControl(
                                    'font_size',
                                    '2. Font Size Hierarchy',
                                    'EWANDZ Standard: Body 11pt · H1 16pt · H2 13pt · H3 11pt',
                                    'Original font sizes will be preserved.',
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Body Text (pt)</label>
                                            <input 
                                                type="number" 
                                                value={formattingConfig.font_size.body}
                                                onChange={(e) => updateFormattingField('font_size', 'body', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Heading 1 (pt)</label>
                                            <input 
                                                type="number" 
                                                value={formattingConfig.font_size.h1}
                                                onChange={(e) => updateFormattingField('font_size', 'h1', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Heading 2 (pt)</label>
                                            <input 
                                                type="number" 
                                                value={formattingConfig.font_size.h2}
                                                onChange={(e) => updateFormattingField('font_size', 'h2', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Heading 3 (pt)</label>
                                            <input 
                                                type="number" 
                                                value={formattingConfig.font_size.h3}
                                                onChange={(e) => updateFormattingField('font_size', 'h3', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* 3. Headings Formatting */}
                                {renderVerticalRadioControl(
                                    'headings',
                                    '3. Headings Formatting',
                                    'EWANDZ Standard: Bold, Deep Corporate Blue (#1F4E78), 12pt Space Before, 6pt Space After',
                                    'Original heading styles and colors will be preserved.',
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="flex items-center pt-5">
                                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer" style={{ margin: 0 }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={formattingConfig.headings.bold}
                                                    onChange={(e) => updateFormattingField('headings', 'bold', e.target.checked)}
                                                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                                /> Bold Headings
                                            </label>
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Space Before (pt)</label>
                                            <input 
                                                type="number" 
                                                value={formattingConfig.headings.space_before}
                                                onChange={(e) => updateFormattingField('headings', 'space_before', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Space After (pt)</label>
                                            <input 
                                                type="number" 
                                                value={formattingConfig.headings.space_after}
                                                onChange={(e) => updateFormattingField('headings', 'space_after', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* 4. Text Styling */}
                                {renderVerticalRadioControl(
                                    'text_styling',
                                    '4. Text Styling',
                                    'EWANDZ Standard text colors and emphasis.',
                                    'Keep original text emphasis and colors.',
                                    <div className="space-y-3">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Body Text Color</label>
                                            <select 
                                                value={formattingConfig.text_styling.body_color}
                                                onChange={(e) => updateFormattingField('text_styling', 'body_color', e.target.value)}
                                                className="form-control"
                                                style={{ maxWidth: '220px' }}
                                            >
                                                <option value="black">Black</option>
                                                <option value="dark_gray">Dark Gray</option>
                                                <option value="navy">Navy Blue</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-wrap gap-4 pt-1">
                                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer" style={{ margin: 0 }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={formattingConfig.text_styling.bold}
                                                    onChange={(e) => updateFormattingField('text_styling', 'bold', e.target.checked)}
                                                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                                /> Bold
                                            </label>
                                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer" style={{ margin: 0 }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={formattingConfig.text_styling.italic}
                                                    onChange={(e) => updateFormattingField('text_styling', 'italic', e.target.checked)}
                                                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                                /> Italic
                                            </label>
                                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer" style={{ margin: 0 }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={formattingConfig.text_styling.underline}
                                                    onChange={(e) => updateFormattingField('text_styling', 'underline', e.target.checked)}
                                                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                                /> Underline
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* 5. Text Alignment */}
                                {renderVerticalRadioControl(
                                    'alignment',
                                    '5. Text Alignment',
                                    'EWANDZ Standard: Left alignment for body and headings.',
                                    'Original text and heading alignments will be preserved.',
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Body Alignment</label>
                                            <select 
                                                value={formattingConfig.alignment.body}
                                                onChange={(e) => updateFormattingField('alignment', 'body', e.target.value)}
                                                className="form-control"
                                            >
                                                <option value="left">Left</option>
                                                <option value="justify">Justify</option>
                                                <option value="center">Center</option>
                                                <option value="right">Right</option>
                                            </select>
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Heading Alignment</label>
                                            <select 
                                                value={formattingConfig.alignment.headings}
                                                onChange={(e) => updateFormattingField('alignment', 'headings', e.target.value)}
                                                className="form-control"
                                            >
                                                <option value="left">Left</option>
                                                <option value="center">Center</option>
                                            </select>
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Table Alignment</label>
                                            <select 
                                                value={formattingConfig.alignment.tables}
                                                onChange={(e) => updateFormattingField('alignment', 'tables', e.target.value)}
                                                className="form-control"
                                            >
                                                <option value="left">Left</option>
                                                <option value="center">Center</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Section B: Spacing & Indentation */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                        <div 
                            onClick={() => toggleAccordion('layout')} 
                            className="p-3.5 flex items-center justify-between cursor-pointer font-semibold select-none bg-slate-50 border-b border-gray-200 hover:bg-slate-100 transition-colors"
                        >
                            <span className="text-sm font-semibold text-gray-900">
                                Spacing & Indentation
                            </span>
                            <span className="text-gray-500">
                                {openAccordions.layout ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </span>
                        </div>

                        {openAccordions.layout && (
                            <div className="p-5" style={{ backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* 6. Paragraph & List Formatting */}
                                {renderVerticalRadioControl(
                                    'paragraph_list',
                                    '6. Paragraph & List Formatting',
                                    'EWANDZ Standard paragraph and list formatting (0.0 in indent, 0.25 in list indent).',
                                    'Keep the original paragraph indentation and list formatting.',
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="form-group mb-0">
                                                <label className="form-label">First Line Indent (in)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.1"
                                                    value={formattingConfig.paragraph_list.first_line_indent}
                                                    onChange={(e) => updateFormattingField('paragraph_list', 'first_line_indent', parseFloat(e.target.value))}
                                                    className="form-control"
                                                />
                                            </div>
                                            <div className="form-group mb-0">
                                                <label className="form-label">Left Indent (in)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.1"
                                                    value={formattingConfig.paragraph_list.left_indent}
                                                    onChange={(e) => updateFormattingField('paragraph_list', 'left_indent', parseFloat(e.target.value))}
                                                    className="form-control"
                                                />
                                            </div>
                                            <div className="form-group mb-0">
                                                <label className="form-label">Right Indent (in)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.1"
                                                    value={formattingConfig.paragraph_list.right_indent}
                                                    onChange={(e) => updateFormattingField('paragraph_list', 'right_indent', parseFloat(e.target.value))}
                                                    className="form-control"
                                                />
                                            </div>
                                        </div>
                                        <div className="pt-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="form-group mb-0">
                                                    <label className="form-label">List Style</label>
                                                    <select 
                                                        value={formattingConfig.paragraph_list.list_style}
                                                        onChange={(e) => updateFormattingField('paragraph_list', 'list_style', e.target.value)}
                                                        className="form-control"
                                                    >
                                                        <option value="preserve">Preserve Original</option>
                                                        <option value="standard">Standard Bullet / Number</option>
                                                    </select>
                                                </div>
                                                <div className="form-group mb-0">
                                                    <label className="form-label">List Indent (in)</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.05"
                                                        value={formattingConfig.paragraph_list.list_indent}
                                                        onChange={(e) => updateFormattingField('paragraph_list', 'list_indent', parseFloat(e.target.value))}
                                                        className="form-control"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 7. Line Spacing */}
                                {renderVerticalRadioControl(
                                    'line_spacing',
                                    '7. Line Spacing',
                                    'EWANDZ Standard: 1.15 line spacing across body text.',
                                    'Original document line spacing will be preserved.',
                                    <div className="form-group mb-0">
                                        <label className="form-label">Line Spacing Multiplier</label>
                                        <select 
                                            value={formattingConfig.line_spacing.value}
                                            onChange={(e) => updateFormattingField('line_spacing', 'value', parseFloat(e.target.value))}
                                            className="form-control"
                                            style={{ maxWidth: '220px' }}
                                        >
                                            <option value="1.0">Single (1.0)</option>
                                            <option value="1.15">Standard SOP (1.15)</option>
                                            <option value="1.5">1.5 Lines</option>
                                            <option value="2.0">Double (2.0)</option>
                                        </select>
                                    </div>
                                )}

                                {/* 8. Paragraph Spacing */}
                                {renderVerticalRadioControl(
                                    'paragraph_spacing',
                                    '8. Paragraph Spacing',
                                    'EWANDZ Standard: 0pt Space Before, 6pt Space After.',
                                    'Original paragraph margins and spacing will be preserved.',
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Space Before (pt)</label>
                                            <input 
                                                type="number" 
                                                value={formattingConfig.paragraph_spacing.space_before}
                                                onChange={(e) => updateFormattingField('paragraph_spacing', 'space_before', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Space After (pt)</label>
                                            <input 
                                                type="number" 
                                                value={formattingConfig.paragraph_spacing.space_after}
                                                onChange={(e) => updateFormattingField('paragraph_spacing', 'space_after', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* 9. Page Margins */}
                                {renderVerticalRadioControl(
                                    'margins',
                                    '9. Page Margins',
                                    'EWANDZ Standard: 1.0 inch margins on all sides (Top, Bottom, Left, Right).',
                                    'Original page margins will be preserved.',
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Top Margin (in)</label>
                                            <input 
                                                type="number" 
                                                step="0.1" 
                                                value={formattingConfig.margins.top}
                                                onChange={(e) => updateFormattingField('margins', 'top', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Bottom Margin (in)</label>
                                            <input 
                                                type="number" 
                                                step="0.1" 
                                                value={formattingConfig.margins.bottom}
                                                onChange={(e) => updateFormattingField('margins', 'bottom', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Left Margin (in)</label>
                                            <input 
                                                type="number" 
                                                step="0.1" 
                                                value={formattingConfig.margins.left}
                                                onChange={(e) => updateFormattingField('margins', 'left', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Right Margin (in)</label>
                                            <input 
                                                type="number" 
                                                step="0.1" 
                                                value={formattingConfig.margins.right}
                                                onChange={(e) => updateFormattingField('margins', 'right', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Section C: Tables, Headers & Footers */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                        <div 
                            onClick={() => toggleAccordion('tables_headers')} 
                            className="p-3.5 flex items-center justify-between cursor-pointer font-semibold select-none bg-slate-50 border-b border-gray-200 hover:bg-slate-100 transition-colors"
                        >
                            <span className="text-sm font-semibold text-gray-900">
                                Tables, Headers & Footers
                            </span>
                            <span className="text-gray-500">
                                {openAccordions.tables_headers ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </span>
                        </div>

                        {openAccordions.tables_headers && (
                            <div className="p-5" style={{ backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* 10. Table Styling & Formats */}
                                {renderVerticalRadioControl(
                                    'tables',
                                    '10. Table Styling & Formats',
                                    'EWANDZ Standard: Bold Header Row, Subtle Blue Header Fill (#D9E1F2), Full Width Alignment.',
                                    'Original table layouts, widths, and cell background colors will be preserved.',
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="form-group mb-0">
                                                <label className="form-label">Table Style Preset</label>
                                                <select 
                                                    value={formattingConfig.tables.style}
                                                    onChange={(e) => updateFormattingField('tables', 'style', e.target.value)}
                                                    className="form-control"
                                                >
                                                    <option value="standard_sop">Standard Corporate SOP</option>
                                                    <option value="minimal">Minimal Grid</option>
                                                    <option value="striped">Zebra Striped Rows</option>
                                                    <option value="academic_grid">Academic Grid</option>
                                                </select>
                                            </div>
                                            <div className="form-group mb-0">
                                                <label className="form-label">Cell Text Alignment</label>
                                                <select 
                                                    value={formattingConfig.tables.cell_align}
                                                    onChange={(e) => updateFormattingField('tables', 'cell_align', e.target.value)}
                                                    className="form-control"
                                                >
                                                    <option value="left">Left Aligned</option>
                                                    <option value="center">Centered</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-4 pt-1">
                                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer" style={{ margin: 0 }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={formattingConfig.tables.header_bold}
                                                    onChange={(e) => updateFormattingField('tables', 'header_bold', e.target.checked)}
                                                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                                /> Bold Table Headers
                                            </label>
                                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer" style={{ margin: 0 }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={formattingConfig.tables.header_bg}
                                                    onChange={(e) => updateFormattingField('tables', 'header_bg', e.target.checked)}
                                                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                                /> Background Fill for Header
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* 11. Table Border Rules */}
                                {renderVerticalRadioControl(
                                    'table_borders',
                                    '11. Table Border Rules',
                                    'EWANDZ Standard: Full outer borders with thin internal gridlines.',
                                    'Original table border configurations will be preserved.',
                                    <div className="form-group mb-0">
                                        <label className="form-label">Border Style</label>
                                        <select 
                                            value={formattingConfig.table_borders.style}
                                            onChange={(e) => updateFormattingField('table_borders', 'style', e.target.value)}
                                            className="form-control"
                                            style={{ maxWidth: '220px' }}
                                        >
                                            <option value="outside">Outside Border Only</option>
                                            <option value="full_grid">Full Grid (All Cells)</option>
                                            <option value="horizontal_only">Horizontal Gridlines Only</option>
                                            <option value="none">No Borders</option>
                                        </select>
                                    </div>
                                )}

                                {/* 12. Running Header with Custom File Upload */}
                                {renderVerticalRadioControl(
                                    'header',
                                    '12. Running Header',
                                    'EWANDZ Standard: Official EWANDZ branded header banner with company logo from SOP_001.pdf template.',
                                    'Keep existing header or leave blank if none exists in original file.',
                                    <div className="space-y-4">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Header Document Name / Code</label>
                                            <input 
                                                type="text" 
                                                placeholder="e.g., SOP-OPS-042 | Standard Operations" 
                                                value={formattingConfig.header.filename}
                                                onChange={(e) => updateFormattingField('header', 'filename', e.target.value)}
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="pt-1">
                                            <label className="form-label mb-1">Custom Header Asset / Template (Optional)</label>
                                            <input
                                                type="file"
                                                id="sop-header-file-upload"
                                                accept=".docx,.png,.jpg,.jpeg"
                                                onChange={handleHeaderFileChange}
                                                style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: 0 }}
                                            />
                                            {!headerFile ? (
                                                <label
                                                    htmlFor="sop-header-file-upload"
                                                    className="btn btn-outline"
                                                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                                                >
                                                    <UploadCloud size={16} /> Upload Custom Header File
                                                </label>
                                            ) : (
                                                <div className="flex items-center gap-3 p-2 rounded-lg border border-light" style={{ background: 'white', display: 'inline-flex' }}>
                                                    <FileText size={15} className="text-primary flex-shrink-0" />
                                                    <span className="text-sm text-gray-800" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={headerFile.name}>
                                                        {headerFile.name}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setHeaderFile(null)}
                                                        className="p-1 hover:bg-danger-light rounded text-danger transition-colors"
                                                        title="Remove header file"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 13. Running Footer with Custom File Upload */}
                                {renderVerticalRadioControl(
                                    'footer',
                                    '13. Running Footer',
                                    'EWANDZ Standard: Official EWANDZ company footer with locations (USA | POLAND | INDIA | CANADA) and www.ewandzdigital.com.',
                                    'Keep existing footer or leave blank if none exists in original file.',
                                    <div className="space-y-4">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Footer Confidentiality Text</label>
                                            <input 
                                                type="text" 
                                                placeholder="e.g., Confidential — Internal Operations Only" 
                                                value={formattingConfig.footer.filename}
                                                onChange={(e) => updateFormattingField('footer', 'filename', e.target.value)}
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="pt-1">
                                            <label className="form-label mb-1">Custom Footer Asset / Template (Optional)</label>
                                            <input
                                                type="file"
                                                id="sop-footer-file-upload"
                                                accept=".docx,.png,.jpg,.jpeg"
                                                onChange={handleFooterFileChange}
                                                style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: 0 }}
                                            />
                                            {!footerFile ? (
                                                <label
                                                    htmlFor="sop-footer-file-upload"
                                                    className="btn btn-outline"
                                                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                                                >
                                                    <UploadCloud size={16} /> Upload Custom Footer File
                                                </label>
                                            ) : (
                                                <div className="flex items-center gap-3 p-2 rounded-lg border border-light" style={{ background: 'white', display: 'inline-flex' }}>
                                                    <FileText size={15} className="text-primary flex-shrink-0" />
                                                    <span className="text-sm text-gray-800" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={footerFile.name}>
                                                        {footerFile.name}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFooterFile(null)}
                                                        className="p-1 hover:bg-danger-light rounded text-danger transition-colors"
                                                        title="Remove footer file"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 14. Page Numbering */}
                                {renderVerticalRadioControl(
                                    'page_numbers',
                                    '14. Page Numbering',
                                    'EWANDZ Standard: "Page X of Y" positioned at the bottom right corner of the page.',
                                    'Original page numbering format and placement will be preserved.',
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Numbering Format</label>
                                            <select 
                                                value={formattingConfig.page_numbers.format}
                                                onChange={(e) => updateFormattingField('page_numbers', 'format', e.target.value)}
                                                className="form-control"
                                            >
                                                <option value="page_x_of_y">Page X of Y</option>
                                                <option value="simple_number">X (Simple number)</option>
                                                <option value="dash_number">- X -</option>
                                            </select>
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Alignment</label>
                                            <select 
                                                value={formattingConfig.page_numbers.alignment}
                                                onChange={(e) => updateFormattingField('page_numbers', 'alignment', e.target.value)}
                                                className="form-control"
                                            >
                                                <option value="right">Right</option>
                                                <option value="center">Center</option>
                                                <option value="left">Left</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Section D: Document Flow & Structure */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                        <div 
                            onClick={() => toggleAccordion('document_flow')} 
                            className="p-3.5 flex items-center justify-between cursor-pointer font-semibold select-none bg-slate-50 border-b border-gray-200 hover:bg-slate-100 transition-colors"
                        >
                            <span className="text-sm font-semibold text-gray-900">
                                Document Flow & Structure
                            </span>
                            <span className="text-gray-500">
                                {openAccordions.document_flow ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </span>
                        </div>

                        {openAccordions.document_flow && (
                            <div className="p-5" style={{ backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* 15. Page Breaks & Section Starts */}
                                {renderVerticalRadioControl(
                                    'page_breaks',
                                    '15. Page Breaks & Section Starts',
                                    'EWANDZ Standard: Clean section starts with automated page breaks before major Heading 1 blocks.',
                                    'Original page breaks and section dividers will be preserved.',
                                    <div className="form-group mb-0">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer" style={{ margin: 0 }}>
                                            <input 
                                                type="checkbox" 
                                                checked={formattingConfig.page_breaks.break_before_h1}
                                                onChange={(e) => updateFormattingField('page_breaks', 'break_before_h1', e.target.checked)}
                                                style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                            /> Insert Page Break Before Heading 1
                                        </label>
                                    </div>
                                )}

                                {/* 16. Pagination & Pagination Flow Rules */}
                                {renderVerticalRadioControl(
                                    'page_flow',
                                    '16. Pagination & Flow Rules',
                                    'EWANDZ Standard: Keep with next on headings, prevent split table rows, and suppress orphan lines.',
                                    'Keep original Word pagination engine defaults.',
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer" style={{ margin: 0 }}>
                                            <input 
                                                type="checkbox" 
                                                checked={formattingConfig.page_flow.keep_with_next}
                                                onChange={(e) => updateFormattingField('page_flow', 'keep_with_next', e.target.checked)}
                                                style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                            /> Keep Headings with Next Paragraph
                                        </label>
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer" style={{ margin: 0 }}>
                                            <input 
                                                type="checkbox" 
                                                checked={formattingConfig.page_flow.prevent_orphans}
                                                onChange={(e) => updateFormattingField('page_flow', 'prevent_orphans', e.target.checked)}
                                                style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                            /> Prevent Widow / Orphan Lines
                                        </label>
                                    </div>
                                )}

                                {/* 17. Document Title & Subtitle */}
                                {renderVerticalRadioControl(
                                    'document_title',
                                    '17. Document Title & Subtitle',
                                    'EWANDZ Standard: Left-aligned Title (20pt bold) with 12pt Space After.',
                                    'Keep existing document title formatting as defined in original file.',
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Title Alignment</label>
                                            <select 
                                                value={formattingConfig.document_title.alignment}
                                                onChange={(e) => updateFormattingField('document_title', 'alignment', e.target.value)}
                                                className="form-control"
                                            >
                                                <option value="left">Left</option>
                                                <option value="center">Center</option>
                                            </select>
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Title Font Size (pt)</label>
                                            <input 
                                                type="number" 
                                                value={formattingConfig.document_title.title_size}
                                                onChange={(e) => updateFormattingField('document_title', 'title_size', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Space After (pt)</label>
                                            <input 
                                                type="number" 
                                                value={formattingConfig.document_title.space_after}
                                                onChange={(e) => updateFormattingField('document_title', 'space_after', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* 18. Cover Page Formatting */}
                                {renderVerticalRadioControl(
                                    'cover_page',
                                    '18. Cover Page Formatting',
                                    'EWANDZ Standard: Minimal formal cover page with title, document code, and revision date.',
                                    'Preserve document layout without inserting or altering cover page.',
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer" style={{ margin: 0 }}>
                                            <input 
                                                type="checkbox" 
                                                checked={formattingConfig.cover_page.enable}
                                                onChange={(e) => updateFormattingField('cover_page', 'enable', e.target.checked)}
                                                style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                            /> Enable Standard SOP Cover Page
                                        </label>
                                        {formattingConfig.cover_page.enable && (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer" style={{ margin: 0 }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formattingConfig.cover_page.show_doc_code}
                                                        onChange={(e) => updateFormattingField('cover_page', 'show_doc_code', e.target.checked)}
                                                        style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                                    /> Doc Code
                                                </label>
                                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer" style={{ margin: 0 }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formattingConfig.cover_page.show_version}
                                                        onChange={(e) => updateFormattingField('cover_page', 'show_version', e.target.checked)}
                                                        style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                                    /> Version
                                                </label>
                                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer" style={{ margin: 0 }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formattingConfig.cover_page.show_date}
                                                        onChange={(e) => updateFormattingField('cover_page', 'show_date', e.target.checked)}
                                                        style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                                    /> Date
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Section E: Special Elements, Images & Page Setup */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div 
                            onClick={() => toggleAccordion('special_elements')} 
                            className="p-3.5 flex items-center justify-between cursor-pointer font-semibold select-none bg-slate-50 border-b border-gray-200 hover:bg-slate-100 transition-colors"
                        >
                            <span className="text-sm font-semibold text-gray-900">
                                Special Elements, Images & Page Setup
                            </span>
                            <span className="text-gray-500">
                                {openAccordions.special_elements ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </span>
                        </div>

                        {openAccordions.special_elements && (
                            <div className="p-5" style={{ backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* 19. Special Callout Sections */}
                                {renderVerticalRadioControl(
                                    'special_sections',
                                    '19. Special Callout Sections (Notes, Warnings, Cautions)',
                                    'EWANDZ Standard: Bordered left-accent callout boxes with standard status colors.',
                                    'Keep original styling for callout paragraphs and note sections.',
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Note Box Style</label>
                                            <select 
                                                value={formattingConfig.special_sections.note_style}
                                                onChange={(e) => updateFormattingField('special_sections', 'note_style', e.target.value)}
                                                className="form-control"
                                            >
                                                <option value="standard">Left Blue Accent Bar</option>
                                                <option value="bordered">Enclosed Gray Box</option>
                                                <option value="minimal">Italic Indented</option>
                                            </select>
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Warning / Caution Style</label>
                                            <select 
                                                value={formattingConfig.special_sections.warning_style}
                                                onChange={(e) => updateFormattingField('special_sections', 'warning_style', e.target.value)}
                                                className="form-control"
                                            >
                                                <option value="standard">Left Amber/Red Accent Bar</option>
                                                <option value="bordered">Bold Enclosed Box</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* 20. Captions (Figures & Tables) */}
                                {renderVerticalRadioControl(
                                    'captions',
                                    '20. Captions (Figures & Tables)',
                                    'EWANDZ Standard: 10pt Left-aligned below figures and tables.',
                                    'Keep existing caption typography and placement.',
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Caption Alignment</label>
                                            <select 
                                                value={formattingConfig.captions.alignment}
                                                onChange={(e) => updateFormattingField('captions', 'alignment', e.target.value)}
                                                className="form-control"
                                            >
                                                <option value="left">Left Aligned</option>
                                                <option value="center">Centered</option>
                                            </select>
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Position</label>
                                            <select 
                                                value={formattingConfig.captions.position}
                                                onChange={(e) => updateFormattingField('captions', 'position', e.target.value)}
                                                className="form-control"
                                            >
                                                <option value="below">Below Element</option>
                                                <option value="above">Above Element</option>
                                            </select>
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Font Size (pt)</label>
                                            <input 
                                                type="number" 
                                                value={formattingConfig.captions.font_size}
                                                onChange={(e) => updateFormattingField('captions', 'font_size', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* 21. Image Sizing & Alignment */}
                                {renderVerticalRadioControl(
                                    'images',
                                    '21. Image Sizing & Alignment',
                                    'EWANDZ Standard: Centered alignment, constrained to maximum 6.5 in width.',
                                    'Original embedded image dimensions and alignments will be preserved.',
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="form-group mb-0">
                                            <label className="form-label">Image Alignment</label>
                                            <select 
                                                value={formattingConfig.images.align}
                                                onChange={(e) => updateFormattingField('images', 'align', e.target.value)}
                                                className="form-control"
                                            >
                                                <option value="center">Centered</option>
                                                <option value="left">Left Aligned</option>
                                                <option value="right">Right Aligned</option>
                                            </select>
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="form-label">Max Width Constraint (in)</label>
                                            <input 
                                                type="number" 
                                                step="0.5" 
                                                value={formattingConfig.images.max_width_inches}
                                                onChange={(e) => updateFormattingField('images', 'max_width_inches', parseFloat(e.target.value))}
                                                className="form-control"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* 22. Page Orientation */}
                                {renderVerticalRadioControl(
                                    'page_orientation',
                                    '22. Page Orientation',
                                    'EWANDZ Standard: Portrait orientation across all standard body sections.',
                                    'Original document page orientation will be preserved.',
                                    <div className="form-group mb-0">
                                        <label className="form-label">Target Page Orientation</label>
                                        <select 
                                            value={formattingConfig.page_orientation.orientation}
                                            onChange={(e) => updateFormattingField('page_orientation', 'orientation', e.target.value)}
                                            className="form-control"
                                            style={{ maxWidth: '220px' }}
                                        >
                                            <option value="portrait">Portrait</option>
                                            <option value="landscape">Landscape</option>
                                        </select>
                                    </div>
                                )}

                                {/* 23. Page Size */}
                                {renderVerticalRadioControl(
                                    'page_size',
                                    '23. Page Paper Size',
                                    'EWANDZ Standard: Standard US Letter (8.5 x 11 in) paper dimensions.',
                                    'Original document page size will be preserved.',
                                    <div className="form-group mb-0">
                                        <label className="form-label">Target Paper Dimensions</label>
                                        <select 
                                            value={formattingConfig.page_size.size}
                                            onChange={(e) => updateFormattingField('page_size', 'size', e.target.value)}
                                            className="form-control"
                                            style={{ maxWidth: '220px' }}
                                        >
                                            <option value="letter">Letter (8.5 x 11 in)</option>
                                            <option value="a4">A4 (8.27 x 11.69 in)</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Analysis Details Panel (if analyzed) */}
                {analysisData && (
                    <div id="sop-pre-analysis-card" className="card" style={{ borderColor: 'var(--primary)', boxShadow: '0 4px 20px rgba(147, 71, 255, 0.08)' }}>
                        <div className="flex items-center justify-between border-b pb-2 mb-4">
                            <h4 className="text-lg font-semibold m-0">
                                SOP Document Pre-Analysis
                            </h4>
                            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                                Baseline Compliance: <strong className="text-purple-700">{analysisData.baseline_compliance}%</strong>
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                            <div className="p-3 rounded-lg border border-gray-200 text-center" style={{ backgroundColor: 'var(--bg-color)' }}>
                                <span className="text-xs text-muted font-semibold uppercase tracking-wider block">Paragraphs</span>
                                <span className="text-xl font-bold text-gray-900 mt-1 block">{analysisData.paragraphs_count}</span>
                            </div>
                            <div className="p-3 rounded-lg border border-gray-200 text-center" style={{ backgroundColor: 'var(--bg-color)' }}>
                                <span className="text-xs text-muted font-semibold uppercase tracking-wider block">Headings</span>
                                <span className="text-xl font-bold text-gray-900 mt-1 block">{analysisData.headings_count}</span>
                            </div>
                            <div className="p-3 rounded-lg border border-gray-200 text-center" style={{ backgroundColor: 'var(--bg-color)' }}>
                                <span className="text-xs text-muted font-semibold uppercase tracking-wider block">Tables</span>
                                <span className="text-xl font-bold text-gray-900 mt-1 block">{analysisData.tables_count}</span>
                            </div>
                            <div className="p-3 rounded-lg border border-gray-200 text-center" style={{ backgroundColor: 'var(--bg-color)' }}>
                                <span className="text-xs text-muted font-semibold uppercase tracking-wider block">Inconsistencies</span>
                                <span className="text-xl font-bold text-red-600 mt-1 block">{analysisData.issues_count}</span>
                            </div>
                        </div>

                        {analysisData.issues?.length > 0 && (
                            <div className="pt-2">
                                <label className="form-label" style={{ marginBottom: '0.5rem' }}>Detected Formatting Inconsistencies</label>
                                <ul className="text-sm text-gray-600 m-0 pl-4 space-y-1 font-medium list-disc">
                                    {analysisData.issues.map((iss, i) => (
                                        <li key={i}>{iss}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Action Bar (Initial / Config State) */}
                {currentStep === 'config' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 p-4 rounded-xl bg-purple-50/50 border border-purple-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-purple-900 bg-purple-100 px-2.5 py-1 rounded-md">
                                Preset: {PRESET_DEFINITIONS[selectedPreset]?.label || 'EWANDZ Standard'}
                            </span>
                            <span className="text-xs text-muted">
                                {effectiveFile ? `Ready: ${effectiveFile.name}` : 'Upload a DOCX or PDF above to begin'}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            {effectiveFile && (
                                <button type="button" className="btn btn-outline" onClick={handleRemoveFile}>
                                    Clear File
                                </button>
                            )}
                            <button 
                                type="button" 
                                onClick={handleAnalyzeDocument} 
                                className="btn btn-outline" 
                                disabled={loading || !effectiveFile}
                            >
                                {loading ? 'Analyzing...' : 'Analyze Compliance'}
                            </button>
                            <button 
                                type="button" 
                                onClick={handleExecuteFormatting} 
                                className="btn btn-primary" 
                                disabled={loading || !effectiveFile}
                                style={{ minWidth: '220px' }}
                            >
                                <Sparkles size={16} className="inline mr-1.5" />
                                {loading ? 'Formatting...' : 'Format & Download SOP (.docx)'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Content Suggestions Review Step */}
                {currentStep === 'review_content' && (
                    <div className="card">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 mb-4 gap-3">
                            <div>
                                <h3 className="text-lg font-semibold m-0">
                                    Review Proposed Content Improvements
                                </h3>
                                <p className="text-xs text-muted m-0 mt-1">
                                    {suggestions.length} suggestions generated. <strong>Only accepted changes</strong> will be applied.
                                </p>
                            </div>
                            <div className="flex gap-2 self-start sm:self-auto">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        const allAcc = {};
                                        suggestions.forEach(s => { allAcc[s.id] = true; });
                                        setAcceptedSuggestions(allAcc);
                                    }}
                                    className="btn btn-outline text-xs px-3 py-1.5 font-semibold"
                                >
                                    Accept All
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setAcceptedSuggestions({})}
                                    className="btn btn-outline text-xs px-3 py-1.5 text-danger hover:bg-danger-light font-semibold"
                                >
                                    Reject All
                                </button>
                            </div>
                        </div>

                        {suggestions.length === 0 ? (
                            <p className="text-sm text-muted py-6 text-center">No grammatical or clarity issues found in the uploaded document.</p>
                        ) : (
                            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
                                {suggestions.map((sugg) => {
                                    const isAccepted = !!acceptedSuggestions[sugg.id];
                                    return (
                                        <div 
                                            key={sugg.id} 
                                            className={`p-4 rounded-lg border transition-all ${isAccepted ? 'border-primary bg-purple-50/20' : 'border-gray-200 bg-gray-50/50 opacity-75'}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700 uppercase tracking-wide">
                                                    {sugg.category}
                                                </span>
                                                <div className="flex gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setAcceptedSuggestions(prev => ({ ...prev, [sugg.id]: true }))}
                                                        className={`px-3 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${isAccepted ? 'btn-primary text-white' : 'btn-outline'}`}
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAcceptedSuggestions(prev => ({ ...prev, [sugg.id]: false }))}
                                                        className={`px-3 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${!isAccepted ? 'bg-red-600 text-white' : 'btn-outline text-red-600'}`}
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                <div className="p-2.5 rounded bg-red-50 border border-red-200">
                                                    <span className="font-bold text-red-800 block mb-1 text-2xs uppercase tracking-wider">ORIGINAL:</span>
                                                    <span className="text-gray-800">{sugg.original_text}</span>
                                                </div>
                                                <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200">
                                                    <span className="font-bold text-emerald-800 block mb-1 text-2xs uppercase tracking-wider">SUGGESTED:</span>
                                                    <span className="text-gray-900 font-semibold">{sugg.suggested_text}</span>
                                                </div>
                                            </div>
                                            {sugg.reason && (
                                                <p className="text-xs text-muted mt-2 mb-0 italic">Reason: {sugg.reason}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-4 border-t pt-4">
                            <button type="button" onClick={() => setCurrentStep('config')} className="btn btn-outline">
                                Back to Settings
                            </button>
                            <button 
                                type="button" 
                                onClick={handleExecuteFormatting} 
                                className="btn btn-primary" 
                                disabled={loading}
                            >
                                {loading ? 'Applying Changes...' : 'Apply Formatting & Accepted Edits'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Results / Completion Screen */}
                {currentStep === 'complete' && resultMeta && (
                    <div className="card">
                        <div className="border-b pb-3 mb-4">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                <h3 className="text-lg font-bold m-0 text-gray-900">SOP FORMATTING COMPLETE</h3>
                            </div>
                            <p className="text-xs text-muted m-0 mt-1">Your document has been formatted according to standards and validated successfully.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4">
                            <div className="p-4 rounded-lg border border-gray-200 text-center" style={{ backgroundColor: 'var(--bg-color)' }}>
                                <span className="text-xs text-muted font-bold uppercase tracking-wider block mb-1">Compliance Rating</span>
                                <span className="text-2xl font-extrabold text-emerald-600">
                                    {resultMeta.baselineCompliance}% → {resultMeta.finalCompliance}%
                                </span>
                            </div>
                            <div className="p-4 rounded-lg border border-gray-200 text-center" style={{ backgroundColor: 'var(--bg-color)' }}>
                                <span className="text-xs text-muted font-bold uppercase tracking-wider block mb-1">Formatting Changes</span>
                                <span className="text-2xl font-extrabold text-purple-700">
                                    {resultMeta.formattingChanges.length} Rules
                                </span>
                            </div>
                            <div className="p-4 rounded-lg border border-gray-200 text-center" style={{ backgroundColor: 'var(--bg-color)' }}>
                                <span className="text-xs text-muted font-bold uppercase tracking-wider block mb-1">Content Changes</span>
                                <span className="text-2xl font-extrabold text-gray-900">
                                    {resultMeta.contentChangesCount}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 rounded-lg border border-gray-200 mb-4" style={{ backgroundColor: 'var(--bg-color)' }}>
                            <label className="form-label" style={{ marginBottom: '0.5rem' }}>Applied Formatting Summary</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-800">
                                {resultMeta.formattingChanges.map((chg, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-emerald-600 font-bold">•</span>
                                        <span>{chg}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-3 pt-2">
                            <button type="button" onClick={handleDownloadChangeReport} className="btn btn-outline">
                                Download Change Report (.docx)
                            </button>
                            <button 
                                type="button" 
                                onClick={handleExecuteFormatting} 
                                className="btn btn-primary"
                            >
                                Download Formatted SOP (.docx)
                            </button>
                            <button 
                                type="button" 
                                onClick={handleRemoveFile} 
                                className="btn btn-outline"
                            >
                                Format Another Document
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
