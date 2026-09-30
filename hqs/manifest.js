window.HQ_DATA = {
  issues: [
    {
      id: 'issue-1',
      number: 1,
      title: 'Cosmic Vanguard #1',
      subtitle: 'A Fronteira Foi Encontrada',
      description: 'A primeira história em quadrinhos oficial do universo Cosmic Vanguard. Descubra a origem dos heróis e a chegada das forças invasoras na fronteira cósmica.',
      pdf: null,
      pageCount: 16,
      pages: Array.from({ length: 16 }, (_, i) => {
        const num = String(i + 1).padStart(2, '0');
        return {
          page: i + 1,
          src: `hqs/issue-1/page_${num}.webp`,
          thumb: `hqs/issue-1/thumbs/thumb_${num}.webp`
        };
      })
    }
  ]
};
