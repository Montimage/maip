const {
  listFiles
} = require('./file-utils');

test('should return an non-empty list of file', () => {
  listFiles('./',"*", (allFiles) => {
    expect(allFiles).not.toBeNull();
  });
 });