import os
# import sys

def listFiles(folder_path, file_extension):
  """
  Get list of all files which have the given extension
  Args:
      folder_path (String): Location to look for the files
      file_extension (String): File Extension, for example: .pkl

  Returns:
      Array: List of files
  """
  all_files = []
  for f in os.listdir(folder_path):
    if f.endswith(file_extension):
      all_files.append(f)
  return all_files
