from app.core.database import get_db_connection


def save_raw_interaction_event(event_data: dict):
    query = """
        INSERT INTO raw_interaction_events (
            student_id,
            lesson_id,
            session_id,
            event_type,
            event_time,
            video_time,
            from_position,
            to_position,
            event_value,
            question_id,
            is_correct
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    values = (
        event_data["student_id"],
        event_data["lesson_id"],
        event_data.get("session_id"),
        event_data["event_type"],
        event_data["event_time"],
        event_data.get("video_time"),
        event_data.get("from_position"),
        event_data.get("to_position"),
        event_data.get("event_value"),
        event_data.get("question_id"),
        event_data.get("is_correct"),
    )
    return _execute_insert(query, values)


def save_feature_window(feature_data: dict):
    query = """
        INSERT INTO feature_windows (
            student_id,
            lesson_id,
            session_id,
            minute_index,
            window_start,
            window_end,
            pause_frequency,
            navigation_count_video,
            rewatch_segments,
            playback_rate_change,
            idle_duration_video,
            time_on_content,
            navigation_count_adaptation,
            revisit_frequency,
            idle_duration_adaptation,
            quiz_response_time,
            error_rate
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    values = (
        feature_data["student_id"],
        feature_data["lesson_id"],
        feature_data.get("session_id"),
        feature_data["minute_index"],
        feature_data.get("window_start"),
        feature_data.get("window_end"),
        feature_data["pause_frequency"],
        feature_data["navigation_count_video"],
        feature_data["rewatch_segments"],
        feature_data["playback_rate_change"],
        feature_data["idle_duration_video"],
        feature_data["time_on_content"],
        feature_data["navigation_count_adaptation"],
        feature_data["revisit_frequency"],
        feature_data["idle_duration_adaptation"],
        feature_data["quiz_response_time"],
        feature_data["error_rate"],
    )
    return _execute_insert(query, values)


def save_prediction_log(prediction_data: dict):
    query = """
        INSERT INTO prediction_logs (
            feature_window_id,
            student_id,
            lesson_id,
            session_id,
            predicted_cognitive_load,
            predicted_score,
            confidence
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    values = (
        prediction_data.get("feature_window_id"),
        prediction_data["student_id"],
        prediction_data["lesson_id"],
        prediction_data.get("session_id"),
        prediction_data["predicted_cognitive_load"],
        prediction_data["predicted_score"],
        prediction_data["confidence"],
    )
    return _execute_insert(query, values)


def get_raw_interaction_events(
    student_id: str,
    lesson_id: str,
    session_id: str,
    window_start,
    window_end,
):
    query = """
        SELECT
            id,
            student_id,
            lesson_id,
            session_id,
            event_type,
            event_time,
            video_time,
            from_position,
            to_position,
            event_value,
            question_id,
            is_correct,
            created_at
        FROM raw_interaction_events
        WHERE student_id = %s
          AND lesson_id = %s
          AND session_id = %s
          AND event_time >= %s
          AND event_time < %s
        ORDER BY event_time ASC, id ASC
    """
    values = (student_id, lesson_id, session_id, window_start, window_end)
    return _execute_select(query, values)


def _execute_insert(query: str, values: tuple):
    connection = get_db_connection()

    if connection is None:
        # The rest of the app can still continue, so we fail softly here.
        return None

    cursor = None

    try:
        cursor = connection.cursor()
        cursor.execute(query, values)
        connection.commit()
        return cursor.lastrowid
    except Exception as exc:
        print(f"MySQL insert failed: {exc}")
        return None
    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def _execute_select(query: str, values: tuple):
    connection = get_db_connection()

    if connection is None:
        # An empty result is easier for the feature extraction flow to handle than a hard crash.
        return []

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, values)
        return cursor.fetchall()
    except Exception as exc:
        print(f"MySQL select failed: {exc}")
        return []
    finally:
        if cursor is not None:
            cursor.close()
        connection.close()
