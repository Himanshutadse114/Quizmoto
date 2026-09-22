const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('Publica shared library pagination', () => {
    const viewer = fs.readFileSync(path.join(__dirname, '../../client/src/pages/Public/FlipbookLibraryViewer.jsx'), 'utf8');
    const styles = fs.readFileSync(path.join(__dirname, '../../client/src/pages/Public/flipbookLibrary.css'), 'utf8');

    it('shows at most six publications on each page', () => {
        expect(viewer).to.include('const BOOKS_PER_PAGE = 6;');
        expect(viewer).to.include('const visibleBooks = books.slice');
        expect(viewer).to.include('visibleBooks.map((book)');
        expect(viewer).to.include('Page {currentPage} of {pageCount}');
    });

    it('uses a three-column desktop grid for two rows of publications', () => {
        expect(styles).to.include('grid-template-columns: repeat(3, minmax(0, 1fr));');
        expect(styles).to.include('align-items: start;');
        expect(styles).to.include('height: 250px;');
        expect(styles).to.include('.public-flip-library-pagination');
    });
});
