# Implementation Plan: CLIP Semantic Search Integration

## Overview

This plan integrates CLIP semantic matching into the existing hybrid missing person search system. The implementation connects existing CLIP components (clipMatching.js and clip_service.py) to the Search API, adds hybrid scoring, implements comprehensive error handling, and includes both unit and property-based tests.

## Tasks

- [x] 1. Install CLIP dependencies and configure environment
  - Install transformers, torch, and PIL packages in face_recognition_module
  - Add FACE_SERVICE_URL to rakshak/.env file (default: http://localhost:5001)
  - Verify CLIP service can start and load the model
  - Test /health endpoint returns correct response
  - _Requirements: 6.1, 6.2, 9.1, 9.2, 9.3_

- [x] 2. Integrate CLIP Client into Search API
  - [x] 2.1 Import rankWithCLIP and buildDescription from clipMatching.js
    - Add import statement at top of search/route.js
    - _Requirements: 2.1_
  
  - [x] 2.2 Call rankWithCLIP after attribute scoring
    - Pass report and top 50 candidates to rankWithCLIP when use_clip is true
    - Handle the returned ranked candidates with clip_similarity scores
    - _Requirements: 2.1, 2.2, 7.1, 7.3_
  
  - [ ]* 2.3 Write property test for CLIP integration
    - **Property 10: Graceful Degradation**
    - **Validates: Requirements 4.3**
    - Test that when CLIP fails, original candidates are returned unchanged

- [x] 3. Implement hybrid scoring in Search API
  - [x] 3.1 Calculate hybrid scores for CLIP-ranked candidates
    - Apply formula: (match_score * 0.4) + (clip_similarity * 60)
    - Add hybrid_score field to each candidate
    - _Requirements: 5.1, 5.2_
  
  - [x] 3.2 Sort candidates by hybrid score
    - Sort in descending order (highest score first)
    - Return top 10 candidates
    - _Requirements: 5.3, 5.5_
  
  - [ ]* 3.3 Write property test for hybrid scoring
    - **Property 11: Hybrid Score Formula**
    - **Validates: Requirements 5.1, 5.2**
    - Test that hybrid_score = (match_score * 0.4) + (clip_similarity * 60)
  
  - [ ]* 3.4 Write property test for hybrid sorting
    - **Property 12: Hybrid Score Sorting**
    - **Validates: Requirements 5.3**
    - Test that results are sorted by hybrid_score descending

- [x] 4. Enhance error handling and logging
  - [x] 4.1 Add timeout protection to CLIP Client
    - Set 30-second timeout on fetch request using AbortSignal.timeout
    - Catch timeout errors and return original candidates
    - _Requirements: 2.7, 4.1, 4.2, 7.6_
  
  - [x] 4.2 Add comprehensive logging to CLIP Client
    - Log start of ranking with candidate count and description
    - Log top 3 similarity scores on success
    - Log error messages on failure
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 4.3 Add error handling to CLIP Service
    - Handle missing description with 400 error
    - Handle empty candidates with 400 error
    - Log individual image processing failures with candidate ID
    - Set clip_similarity to 0.0 for failed images
    - _Requirements: 3.8, 4.1, 8.4, 8.5_
  
  - [ ]* 4.4 Write unit tests for error handling
    - Test CLIP Client with network error
    - Test CLIP Client with HTTP error response
    - Test CLIP Client with timeout
    - Test CLIP Service with invalid image URLs
    - Test CLIP Service with missing required fields

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement and test description builder
  - [x] 6.1 Review buildDescription function in clipMatching.js
    - Verify all structured fields are included
    - Verify age range formatting (age X-Y)
    - Verify hair attribute formatting (length color hair)
    - Verify comma-space separation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [ ]* 6.2 Write property test for description completeness
    - **Property 1: Description Builder Completeness**
    - **Validates: Requirements 1.1, 1.3, 1.5**
    - Test that all non-empty attributes appear in description
  
  - [ ]* 6.3 Write property test for age range formatting
    - **Property 2: Age Range Formatting**
    - **Validates: Requirements 1.2**
    - Test that age_min and age_max produce "age X-Y" format
  
  - [ ]* 6.4 Write property test for hair formatting
    - **Property 3: Hair Attribute Formatting**
    - **Validates: Requirements 1.4**
    - Test that hair_length and hair_color produce "length color hair" format
  
  - [ ]* 6.5 Write property test for comma separation
    - **Property 4: Description Comma Separation**
    - **Validates: Requirements 1.6**
    - Test that multiple attributes are joined with ", "
  
  - [ ]* 6.6 Write unit tests for description builder
    - Test with all fields populated
    - Test with empty report (edge case)
    - Test with partial fields
    - Test with special characters in text fields

- [x] 7. Implement and test CLIP Service endpoints
  - [x] 7.1 Review /clip-rank endpoint implementation
    - Verify text encoding and normalization
    - Verify image encoding and normalization
    - Verify cosine similarity calculation
    - Verify sorting by clip_similarity descending
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9_
  
  - [x] 7.2 Add image download timeout to CLIP Service
    - Set 5-second timeout on requests.get for images
    - Handle timeout exceptions gracefully
    - _Requirements: 7.5_
  
  - [ ]* 7.3 Write property test for embedding normalization
    - **Property 7: Embedding Normalization**
    - **Validates: Requirements 3.2, 3.5**
    - Test that text and image embeddings have L2 norm = 1.0
  
  - [ ]* 7.4 Write property test for cosine similarity
    - **Property 8: Cosine Similarity Calculation**
    - **Validates: Requirements 3.6**
    - Test that cosine similarity equals dot product for normalized vectors
    - Test that similarity is in range [0.0, 1.0]
  
  - [ ]* 7.5 Write property test for CLIP response sorting
    - **Property 6: CLIP Response Sorting**
    - **Validates: Requirements 2.6, 3.9**
    - Test that candidates are sorted by clip_similarity descending
  
  - [ ]* 7.6 Write unit tests for CLIP Service
    - Test /clip-rank with valid request
    - Test /clip-rank with missing description
    - Test /clip-rank with empty candidates
    - Test /clip-rank with invalid image URLs
    - Test /health endpoint format

- [x] 8. Implement response format consistency
  - [x] 8.1 Update Search API response format
    - Include clip_similarity field when CLIP succeeds
    - Omit clip_similarity field when CLIP fails or disabled
    - Always include match_score, matched_attributes, match_confidence
    - Include total_candidates count
    - Include filters_applied object
    - Include clip_enabled flag in metadata when use_clip is true
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 8.6_
  
  - [ ]* 8.2 Write property test for field preservation
    - **Property 13: Response Field Preservation**
    - **Validates: Requirements 5.4, 10.4**
    - Test that match_score, matched_attributes, match_confidence always present
  
  - [ ]* 8.3 Write property test for result limit
    - **Property 14: Result Limit**
    - **Validates: Requirements 5.5**
    - Test that returned matches <= 10 (or specified limit)
  
  - [ ]* 8.4 Write unit tests for response format
    - Test response with use_clip=false
    - Test response with use_clip=true and CLIP success
    - Test response with use_clip=true and CLIP failure
    - Verify all required fields present in each case

- [x] 9. Implement field mapping and preservation
  - [x] 9.1 Verify field mapping in CLIP Client
    - Map selfie_url to image_url in request
    - Preserve all candidate fields (id, name, phone, gender, etc.)
    - Preserve match_score and matched_attributes from attribute scoring
    - _Requirements: 2.4, 2.5_
  
  - [ ]* 9.2 Write property test for field mapping
    - **Property 5: Field Mapping Consistency**
    - **Validates: Requirements 2.4, 2.5**
    - Test that selfie_url maps to image_url
    - Test that all other fields are preserved

- [x] 10. Final checkpoint and integration testing
  - [x] 10.1 Run all unit tests
    - Verify all unit tests pass
    - Check test coverage >80%
  
  - [x] 10.2 Run all property-based tests
    - Verify all 16 properties pass
    - Check minimum 100 iterations per property
  
  - [x] 10.3 Test end-to-end hybrid search flow
    - Create test missing report with structured attributes
    - Register test users with matching/non-matching attributes
    - Call search API with use_clip=true
    - Verify hybrid scores calculated correctly
    - Verify results sorted by hybrid score
    - Verify response format correct
  
  - [x] 10.4 Test graceful degradation
    - Stop CLIP service
    - Call search API with use_clip=true
    - Verify search returns attribute-based results
    - Verify no errors thrown
  
  - [x] 10.5 Performance validation
    - Measure CLIP ranking time for 50 candidates
    - Verify total time < 30 seconds
    - Verify timeout protection works

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (16 total)
- Unit tests validate specific examples and edge cases
- The CLIP Client (clipMatching.js) and CLIP Service (clip_service.py) already exist and may only need minor fixes
- Focus on integration, error handling, and comprehensive testing
